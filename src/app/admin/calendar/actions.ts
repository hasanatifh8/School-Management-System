"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { isoDate, parseISODate } from "@/lib/attendance-shared";
import { MAX_HOLIDAY_DAYS, syncEventHolidays } from "@/lib/calendar";
import { EVENT_TYPES } from "@/lib/calendar-shared";
import { db } from "@/lib/db";
import { readDocumentUpload } from "@/lib/documents";
import { ATTACHMENT_TYPES } from "@/lib/notices-shared";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";

const DAY = 86_400_000;

const eventSchema = z
  .object({
    type: z.enum(EVENT_TYPES, "Choose what kind of entry this is"),
    title: z.string().trim().min(2, "Enter a title").max(80, "Keep it under 80 letters"),
    startDate: z.string().refine((v) => parseISODate(v), "Choose the date"),
    endDate: z.string().optional(),
    description: z.string().trim().max(300).optional().transform((v) => v || null),
    scope: z.enum(["all", "some"]).default("all"),
  })
  .transform((v, ctx) => {
    const endDate = v.endDate && parseISODate(v.endDate) ? v.endDate : v.startDate;
    if (endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end date is before the start date" });
      return z.NEVER;
    }
    return { ...v, endDate };
  });

/** The optional attachment: a PDF, PNG or JPG up to 4 MB. Null when none was chosen. */
async function readAttachment(formData: FormData) {
  const f = formData.get("attachment");
  if (!(f instanceof File) || f.size === 0) return { file: null };
  const upload = await readDocumentUpload(formData, "attachment");
  const bad = (message: string): ActionState & { error: string } => ({ error: message, fieldErrors: { attachment: [message] } });
  if ("error" in upload) return bad(upload.error.startsWith("Only ") ? "Attach a PDF, PNG or JPG file." : upload.error);
  if (!ATTACHMENT_TYPES.has(upload.file.mimeType)) return bad("Attach a PDF, PNG or JPG file.");
  return { file: upload.file };
}

/** Adds (id null) or changes a calendar entry. New entries are drafts until published. */
export async function saveCalendarEvent(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool(); // admins / Power Admin only
  const viewer = await getViewer();
  const session = await getCurrentSession(school.id);
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { type, title, startDate, endDate, description, scope } = parsed.data;

  const start = isoDate(session.startDate);
  const end = isoDate(session.endDate);
  if (startDate < start || endDate > end) {
    return { error: `Entries must fall within session ${session.name}.`, fieldErrors: { startDate: ["Outside this session"] } };
  }
  const days = (parseISODate(endDate)!.getTime() - parseISODate(startDate)!.getTime()) / DAY + 1;
  if (type === "HOLIDAY" && days > MAX_HOLIDAY_DAYS) {
    return { error: `A holiday can cover at most ${MAX_HOLIDAY_DAYS} days.`, fieldErrors: { endDate: ["Range too long"] } };
  }

  // Whole school, or the ticked classes.
  const valid = new Set((await db.schoolClass.findMany({ where: { schoolId: school.id }, select: { id: true } })).map((c) => c.id));
  const classIds = scope === "some" ? formData.getAll("classIds").map(String).filter((c) => valid.has(c)) : [];
  if (scope === "some" && !classIds.length) return { error: "Tick at least one class, or choose the whole school.", fieldErrors: { classIds: ["Tick a class"] } };
  if (type === "HOLIDAY" && classIds.length) {
    return { error: "A holiday is for the whole school. For one class, mark it off on that class's attendance page.", fieldErrors: { classIds: ["Whole school only"] } };
  }

  const attachment = await readAttachment(formData);
  if ("error" in attachment) return attachment;
  const file = attachment.file && { fileName: attachment.file.fileName, mimeType: attachment.file.mimeType, size: attachment.file.size, data: attachment.file.data };

  const data = { type, title, startDate: parseISODate(startDate)!, endDate: parseISODate(endDate)!, description, classIds };
  if (id) {
    const existing = await db.calendarEvent.findFirst({ where: { id, schoolId: school.id } });
    if (!existing) return { error: "Entry not found." };
    const removeFile = formData.get("removeAttachment") === "on";
    // A published entry stays published; its holiday days follow the change.
    await db.$transaction(async (tx) => {
      await syncEventHolidays(tx, await tx.calendarEvent.update({ where: { id }, data }));
      if (file) await tx.calendarAttachment.upsert({ where: { eventId: id }, create: { eventId: id, ...file }, update: { ...file, createdAt: new Date() } });
      else if (removeFile) await tx.calendarAttachment.deleteMany({ where: { eventId: id } });
    });
  } else {
    await db.calendarEvent.create({
      data: {
        ...data,
        schoolId: school.id,
        sessionId: session.id,
        createdBy: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin",
        ...(file && { attachment: { create: file } }),
      },
    });
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/calendar?month=${startDate.slice(0, 7)}`);
  return { ok: true, message: "Entry saved." };
}

export async function deleteCalendarEvent(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  // Holiday days it added go with it (cascade).
  const { count } = await db.calendarEvent.deleteMany({ where: { id, schoolId: school.id } });
  if (!count) return { error: "Entry not found." };
  revalidatePath("/", "layout");
  redirect("/admin/calendar");
}

/** Shows every draft to teachers; published holidays become attendance holidays. */
export async function publishCalendar(): Promise<ActionState> {
  const school = await getCurrentSchool();
  const session = await getCurrentSession(school.id);
  const drafts = await db.calendarEvent.findMany({ where: { schoolId: school.id, sessionId: session.id, published: false } });
  if (!drafts.length) return { error: "Nothing to publish." };
  await db.$transaction(async (tx) => {
    for (const e of drafts) await syncEventHolidays(tx, await tx.calendarEvent.update({ where: { id: e.id }, data: { published: true } }));
  });
  revalidatePath("/", "layout");
  const holidays = drafts.filter((e) => e.type === "HOLIDAY").length;
  return {
    ok: true,
    message: `Published ${drafts.length} entr${drafts.length === 1 ? "y" : "ies"}. Teachers can see the calendar now.${holidays ? ` ${holidays} holiday(s) added to attendance.` : ""}`,
  };
}
