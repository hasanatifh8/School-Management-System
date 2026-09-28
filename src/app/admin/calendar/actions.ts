"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { isoDate, parseISODate } from "@/lib/attendance-shared";
import { MAX_HOLIDAY_DAYS, syncEventHolidays } from "@/lib/calendar";
import { EVENT_TYPES } from "@/lib/calendar-shared";
import { db } from "@/lib/db";
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

  const data = { type, title, startDate: parseISODate(startDate)!, endDate: parseISODate(endDate)!, description, classIds };
  if (id) {
    const existing = await db.calendarEvent.findFirst({ where: { id, schoolId: school.id } });
    if (!existing) return { error: "Entry not found." };
    // A published entry stays published; its holiday days follow the change.
    await db.$transaction(async (tx) => syncEventHolidays(tx, await tx.calendarEvent.update({ where: { id }, data })));
  } else {
    await db.calendarEvent.create({
      data: { ...data, schoolId: school.id, sessionId: session.id, createdBy: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" },
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
