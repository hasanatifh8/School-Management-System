"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { getActor } from "@/lib/access";
import { attendanceWindow } from "@/lib/attendance";
import {
  ATTENDANCE_STATUSES,
  addDays,
  formatISO,
  isSunday,
  parseISODate,
  shortDate,
  type AttendanceStatusKey,
} from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool, getViewer } from "@/lib/school";

/**
 * Checks the signed-in user may take attendance for this section on this date:
 * school admins / Power Admin for any section of their school, teachers only
 * for the section they are class teacher of.
 */
async function sectionAccess(sectionId: string, date: string) {
  const actor = await getActor();
  const school = actor.kind === "staff" ? actor.school : actor.ctx.school;
  if (actor.kind === "teacher" && actor.ctx.classSection?.id !== sectionId) {
    return { error: "You can only take attendance for your own class." } as const;
  }
  const section = await db.section.findFirst({
    where: { id: sectionId, class: { schoolId: school.id } },
    include: { class: true },
  });
  if (!section) return { error: "Class not found." } as const;

  const d = parseISODate(date);
  const win = await attendanceWindow(school.id);
  if (!d || date < win.min || date > win.max) {
    return { error: `Choose a date in session ${win.session.name}, up to today.` } as const;
  }

  let markedBy: string;
  if (actor.kind === "teacher") markedBy = `${fullName(actor.ctx.teacher)} (class teacher)`;
  else {
    const viewer = await getViewer();
    markedBy = viewer?.kind === "admin" ? `${viewer.admin.name} (admin)` : "Power Admin";
  }
  return { school, section, d, markedBy };
}

const remarkSchema = z.string().trim().max(120, "Keep remarks under 120 characters");

export async function saveAttendance(sectionId: string, date: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const access = await sectionAccess(sectionId, date);
  if ("error" in access) return { error: access.error };
  const { school, section, d, markedBy } = access;

  const holiday = await db.holiday.findUnique({ where: { schoolId_date: { schoolId: school.id, date: d } } });
  if (holiday) return { error: `${formatISO(date, shortDate)} is a school holiday (${holiday.name}).` };

  const roster = await db.student.findMany({ where: { sectionId, status: "ACTIVE" }, select: { id: true } });
  if (!roster.length) return { error: "There are no students in this class." };

  const records: { studentId: string; status: AttendanceStatusKey; remark: string | null }[] = [];
  for (const { id } of roster) {
    const status = ATTENDANCE_STATUSES.find((s) => s === formData.get(`s:${id}`));
    if (!status) return { error: "Mark every student before saving." };
    const remark = remarkSchema.safeParse(formData.get(`r:${id}`) ?? "");
    if (!remark.success) return { error: remark.error.issues[0].message };
    records.push({ studentId: id, status, remark: remark.data || null });
  }

  await db.$transaction(async (tx) => {
    const day = await tx.attendanceDay.upsert({
      where: { sectionId_date: { sectionId, date: d } },
      create: { schoolId: school.id, sectionId, date: d, markedBy },
      update: { holiday: null, markedBy },
    });
    await tx.attendanceRecord.deleteMany({ where: { dayId: day.id, studentId: { in: roster.map((s) => s.id) } } });
    await tx.attendanceRecord.createMany({ data: records.map((r) => ({ ...r, dayId: day.id })) });
  });

  revalidatePath("/", "layout");
  const absent = records.filter((r) => r.status === "ABSENT").length;
  return {
    ok: true,
    message: `Saved attendance for ${sectionLabel(section)} on ${formatISO(date, shortDate)}: ${records.length - absent} of ${records.length} attending${absent ? `, ${absent} absent` : ""}.`,
  };
}

const reasonSchema = z.object({
  reason: z.string().trim().min(2, "Say why the class is off, e.g. “Class picnic”").max(80),
});

/** Marks one class as off for a day. Any attendance already taken that day is cleared. */
export async function setClassHoliday(sectionId: string, date: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const access = await sectionAccess(sectionId, date);
  if ("error" in access) return { error: access.error };
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { school, section, d, markedBy } = access;

  await db.$transaction(async (tx) => {
    const day = await tx.attendanceDay.upsert({
      where: { sectionId_date: { sectionId, date: d } },
      create: { schoolId: school.id, sectionId, date: d, holiday: parsed.data.reason, markedBy },
      update: { holiday: parsed.data.reason, markedBy },
    });
    await tx.attendanceRecord.deleteMany({ where: { dayId: day.id } });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `${sectionLabel(section)} is marked as off on ${formatISO(date, shortDate)}.` };
}

export async function clearClassHoliday(sectionId: string, date: string): Promise<ActionState> {
  const access = await sectionAccess(sectionId, date);
  if ("error" in access) return { error: access.error };
  await db.attendanceDay.deleteMany({ where: { sectionId, date: access.d, holiday: { not: null } } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Holiday removed. You can take attendance for this day now." };
}

/* ───────────────────────── School holidays (admins only) ───────────────────────── */

const MAX_HOLIDAY_DAYS = 60;

const holidaySchema = z
  .object({
    name: z.string().trim().min(2, "Enter the holiday name").max(80),
    from: z.string().refine((v) => parseISODate(v), "Choose a date"),
    to: z.string().optional(),
  })
  .transform((v, ctx) => {
    const to = v.to && parseISODate(v.to) ? v.to : v.from;
    if (to < v.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "The end date is before the start date" });
      return z.NEVER;
    }
    return { ...v, to };
  });

export async function addSchoolHoliday(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool(); // admins / Power Admin only
  const parsed = holidaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { name, from, to } = parsed.data;

  const { session } = await attendanceWindow(school.id);
  const start = session.startDate.toISOString().slice(0, 10);
  const end = session.endDate.toISOString().slice(0, 10);
  if (from < start || to > end) {
    return { error: `Holidays must fall within session ${session.name}.`, fieldErrors: { from: ["Outside this session"] } };
  }

  // Sundays are already off, so a range skips them (a single Sunday is kept as chosen).
  const dates: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (from === to || !isSunday(day)) dates.push(day);
    if (dates.length > MAX_HOLIDAY_DAYS) {
      return { error: `Add at most ${MAX_HOLIDAY_DAYS} days at a time.`, fieldErrors: { to: ["Range too long"] } };
    }
  }
  const existing = await db.holiday.findMany({
    where: { schoolId: school.id, date: { in: dates.map((x) => parseISODate(x)!) } },
    select: { date: true },
  });
  const taken = new Set(existing.map((h) => h.date.toISOString().slice(0, 10)));
  const fresh = dates.filter((x) => !taken.has(x));
  if (!fresh.length) return { error: "These dates are already holidays." };

  await db.holiday.createMany({ data: fresh.map((x) => ({ schoolId: school.id, date: parseISODate(x)!, name })) });
  revalidatePath("/", "layout");
  const skipped = dates.length - fresh.length;
  return {
    ok: true,
    message: `Added “${name}” for ${fresh.length} day${fresh.length === 1 ? "" : "s"}${skipped ? ` (${skipped} already a holiday)` : ""}.`,
  };
}

/** Removes a holiday (all the days of a multi-day break at once). */
export async function deleteSchoolHolidays(ids: string[]): Promise<ActionState> {
  const school = await getCurrentSchool();
  const { count } = await db.holiday.deleteMany({ where: { id: { in: ids }, schoolId: school.id } });
  if (!count) return { error: "Holiday not found." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Holiday removed." };
}
