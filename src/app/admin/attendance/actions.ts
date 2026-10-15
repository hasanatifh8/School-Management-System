"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { getActor } from "@/lib/access";
import { attendanceWindow, getSaturdayOff, weeklyOffOn } from "@/lib/attendance";
import {
  ATTENDANCE_STATUSES,
  STATUS_META,
  addDays,
  formatISO,
  isWeeklyOff,
  parseISODate,
  shortDate,
  type AttendanceStatusKey,
} from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { onLeave, syncAttendanceLeave } from "@/lib/leave";
import { saveStaffSheet } from "@/lib/staff-attendance";
import { STAFF_STATUSES, STAFF_STATUS_META, type StaffGroup } from "@/lib/staff-attendance-shared";

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

  const off = await weeklyOffOn(school.id, date);
  if (off) return { error: `${formatISO(date, shortDate)} is a ${off}, a weekly off. No attendance is taken.` };
  const holiday = await db.holiday.findUnique({ where: { schoolId_date: { schoolId: school.id, date: d } } });
  if (holiday) return { error: `${formatISO(date, shortDate)} is a school holiday (${holiday.name}).` };

  const roster = await db.student.findMany({ where: { sectionId, status: "ACTIVE" }, select: { id: true } });
  if (!roster.length) return { error: "There are no students in this class." };

  // Students on approved leave stay on Leave (keeping their saved remark) when a teacher saves; admins can change them.
  const [leave, viewer] = await Promise.all([onLeave(school.id, d), getViewer()]);
  const locked = new Set(viewer ? [] : roster.filter((s) => leave.has(s.id)).map((s) => s.id));
  const savedRemarks = new Map(
    (
      await db.attendanceRecord.findMany({
        where: { studentId: { in: [...locked] }, day: { sectionId, date: d } },
        select: { studentId: true, remark: true },
      })
    ).map((r) => [r.studentId, r.remark]),
  );

  const records: { studentId: string; status: AttendanceStatusKey; remark: string | null }[] = [];
  for (const { id } of roster) {
    if (locked.has(id)) {
      records.push({ studentId: id, status: "LEAVE", remark: savedRemarks.get(id) || "Approved leave" });
      continue;
    }
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
  await syncAttendanceLeave(school.id, d, records, markedBy);

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
  // Nobody is marked that day now, so leave made from its attendance goes too.
  const students = await db.student.findMany({ where: { sectionId }, select: { id: true } });
  await syncAttendanceLeave(school.id, d, students.map((s) => ({ studentId: s.id, status: "OFF", remark: null })), markedBy);
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

  // Weekly offs are already off, so a range skips them (a single day is kept as chosen).
  const saturdayOff = await getSaturdayOff(school.id);
  const dates: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (from === to || !isWeeklyOff(day, saturdayOff)) dates.push(day);
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

/* ───────────────────────── Staff attendance (admins only) ───────────────────────── */

export async function saveStaffAttendance(group: StaffGroup, date: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  if (!parseISODate(date) || date < win.min || date > win.max) return { error: `Choose a date in session ${win.session.name}, up to today.` };
  const viewer = await getViewer();
  const result = await saveStaffSheet(school.id, group, date, formData, viewer?.kind === "admin" ? `${viewer.admin.name} (admin)` : "Power Admin");
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/* ───────────────────────── Register edits (admins only, with a reason) ───────────────────────── */

const editNoteSchema = z.string().trim().min(3, "Say why you are changing it").max(200, "Keep the note under 200 characters");

async function editAccess(date: string) {
  const school = await getCurrentSchool(); // admins / Power Admin only
  const win = await attendanceWindow(school.id);
  const d = parseISODate(date);
  if (!d || date < win.min || date > win.max) return { error: `Choose a date in session ${win.session.name}, up to today.` } as const;
  const viewer = await getViewer();
  return { school, d, by: viewer?.kind === "admin" ? `${viewer.admin.name} (admin)` : "Power Admin" };
}

/** Changes one teacher's or staff member's mark for one day from the register. Fields: group, personId, date, status, note. */
export async function editStaffMark(_: ActionState, formData: FormData): Promise<ActionState> {
  const group = formData.get("group") === "non-teaching" ? "non-teaching" : "teaching";
  const personId = String(formData.get("personId") ?? "");
  const date = String(formData.get("date") ?? "");
  const access = await editAccess(date);
  if ("error" in access) return { error: access.error };
  const { school, d, by } = access;
  const off = await weeklyOffOn(school.id, date);
  if (off) return { error: `${formatISO(date, shortDate)} is a ${off}, a weekly off. No attendance is taken.` };
  const status = STAFF_STATUSES.find((s) => s === formData.get("status"));
  if (!status) return { error: "Choose a status." };
  const note = editNoteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) return { error: note.error.issues[0].message, fieldErrors: { note: [note.error.issues[0].message] } };

  const teaching = group === "teaching";
  const person = teaching
    ? await db.teacher.findFirst({ where: { id: personId, schoolId: school.id } }).then((t) => t && { name: fullName(t) })
    : await db.staffMember.findFirst({ where: { id: personId, schoolId: school.id } }).then((s) => s && { name: s.name });
  if (!person) return { error: "Person not found." };
  const where = teaching ? { teacherId_date: { teacherId: personId, date: d } } : { staffId_date: { staffId: personId, date: d } };
  const existing = await db.staffAttendance.findUnique({ where });
  if (existing?.status === status) return { error: `Already marked ${STAFF_STATUS_META[status].label.toLowerCase()}.` };

  await db.$transaction([
    db.staffAttendance.upsert({
      where,
      create: { schoolId: school.id, date: d, [teaching ? "teacherId" : "staffId"]: personId, status, markedBy: by },
      update: { status, markedBy: by },
    }),
    db.attendanceChange.create({
      data: {
        schoolId: school.id,
        date: d,
        [teaching ? "teacherId" : "staffId"]: personId,
        personName: person.name,
        fromStatus: existing?.status ?? null,
        toStatus: status,
        note: note.data,
        changedBy: by,
      },
    }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, message: `${person.name}: ${STAFF_STATUS_META[status].label} on ${formatISO(date, shortDate)}.` };
}

/** Changes one student's mark on a day already marked, from the register. Fields: sectionId, studentId, date, status, note. */
export async function editStudentMark(_: ActionState, formData: FormData): Promise<ActionState> {
  const sectionId = String(formData.get("sectionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const date = String(formData.get("date") ?? "");
  const access = await editAccess(date);
  if ("error" in access) return { error: access.error };
  const { school, d, by } = access;
  const off = await weeklyOffOn(school.id, date);
  if (off) return { error: `${formatISO(date, shortDate)} is a ${off}, a weekly off. No attendance is taken.` };
  const status = ATTENDANCE_STATUSES.find((s) => s === formData.get("status"));
  if (!status) return { error: "Choose a status." };
  const note = editNoteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) return { error: note.error.issues[0].message, fieldErrors: { note: [note.error.issues[0].message] } };

  const [student, day] = await Promise.all([
    db.student.findFirst({ where: { id: studentId, schoolId: school.id } }),
    db.attendanceDay.findFirst({ where: { sectionId, date: d, schoolId: school.id }, include: { records: { where: { studentId } } } }),
  ]);
  if (!student) return { error: "Student not found." };
  if (!day || day.holiday) return { error: "Take this class's attendance for the day first." };
  const existing = day.records[0];
  if (!existing && student.sectionId !== sectionId) return { error: "This student isn't in this class." };
  if (existing?.status === status) return { error: `Already marked ${STATUS_META[status].label.toLowerCase()}.` };

  await db.$transaction([
    db.attendanceRecord.upsert({
      where: { dayId_studentId: { dayId: day.id, studentId } },
      create: { dayId: day.id, studentId, status, remark: note.data },
      update: { status, remark: note.data },
    }),
    db.attendanceChange.create({
      data: {
        schoolId: school.id,
        date: d,
        studentId,
        personName: fullName(student),
        fromStatus: existing?.status ?? null,
        toStatus: status,
        note: note.data,
        changedBy: by,
      },
    }),
  ]);
  await syncAttendanceLeave(school.id, d, [{ studentId, status, remark: note.data }], by);
  revalidatePath("/", "layout");
  return { ok: true, message: `${fullName(student)}: ${STATUS_META[status].label} on ${formatISO(date, shortDate)}.` };
}
