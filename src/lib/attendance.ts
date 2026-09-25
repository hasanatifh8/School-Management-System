import "server-only";
import { db } from "@/lib/db";
import {
  attendancePercent,
  emptyCounts,
  isSunday,
  isoDate,
  monthDates,
  parseISODate,
  todayISO,
  type AttendanceCounts,
  type AttendanceStatusKey,
} from "@/lib/attendance-shared";
import { photoUrl } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";

/** Dates attendance can be taken for: the current session up to today. */
export async function attendanceWindow(schoolId: string) {
  const session = await getCurrentSession(schoolId);
  const today = todayISO();
  const start = isoDate(session.startDate);
  const end = isoDate(session.endDate);
  const max = today < end ? today : end;
  return { session, min: start, max: max < start ? start : max, today };
}

type Window = Awaited<ReturnType<typeof attendanceWindow>>;

/** The requested date if valid and inside the window, else the latest allowed day. */
export function pickDate(param: string | string[] | undefined, win: Window) {
  const iso = typeof param === "string" && parseISODate(param) ? param : null;
  if (!iso) return win.max;
  return iso < win.min ? win.min : iso > win.max ? win.max : iso;
}

/** The requested month ("2026-09") clamped to the window, else the latest one. */
export function pickMonth(param: string | string[] | undefined, win: Window) {
  const month = typeof param === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : win.max.slice(0, 7);
  return month < win.min.slice(0, 7) ? win.min.slice(0, 7) : month > win.max.slice(0, 7) ? win.max.slice(0, 7) : month;
}

/** School holidays between two ISO dates (inclusive), keyed by date. */
export async function schoolHolidays(schoolId: string, from: string, to: string) {
  const rows = await db.holiday.findMany({
    where: { schoolId, date: { gte: parseISODate(from)!, lte: parseISODate(to)! } },
    orderBy: { date: "asc" },
  });
  return new Map(rows.map((h) => [isoDate(h.date), h]));
}

export const rosterSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  rollNumber: true,
  photoId: true,
  studentCode: true,
} as const;

/** Everything needed to show or take one section's attendance on one day. */
export async function loadAttendanceSheet(schoolId: string, sectionId: string, date: string) {
  const d = parseISODate(date)!;
  const [students, day, holiday] = await Promise.all([
    db.student.findMany({
      where: { sectionId, status: "ACTIVE" },
      orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
      select: rosterSelect,
    }),
    db.attendanceDay.findUnique({ where: { sectionId_date: { sectionId, date: d } }, include: { records: true } }),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId, date: d } } }),
  ]);
  return { students, day, holiday };
}

/** Props for <AttendanceSheet> (everything except the bound actions). */
export async function attendanceSheetProps(schoolId: string, sectionId: string, date: string) {
  const { students, day, holiday } = await loadAttendanceSheet(schoolId, sectionId, date);
  const marked = day && !day.holiday && day.records.length > 0;
  return {
    students: students.map((s) => ({
      id: s.id,
      name: fullName(s),
      roll: s.rollNumber,
      photoUrl: photoUrl(s.photoId),
      code: s.studentCode,
    })),
    initial: marked
      ? Object.fromEntries(day.records.map((r) => [r.studentId, { status: r.status, remark: r.remark ?? "" }]))
      : null,
    markedBy: day?.markedBy ?? null,
    schoolHoliday: holiday?.name ?? null,
    classHoliday: day?.holiday ?? null,
    sunday: isSunday(date),
  };
}

/** Per-status counts and percentage for each student over a date range, ignoring holidays. */
export async function attendanceTotals(schoolId: string, studentIds: string[], from: string, to: string) {
  const [records, holidays] = await Promise.all([
    db.attendanceRecord.findMany({
      where: {
        studentId: { in: studentIds },
        day: { date: { gte: parseISODate(from)!, lte: parseISODate(to)! }, holiday: null },
      },
      select: { studentId: true, status: true, day: { select: { date: true } } },
    }),
    schoolHolidays(schoolId, from, to),
  ]);
  const totals = new Map<string, AttendanceCounts>(studentIds.map((id) => [id, emptyCounts()]));
  for (const r of records) {
    if (holidays.has(isoDate(r.day.date))) continue;
    totals.get(r.studentId)![r.status]++;
  }
  return totals;
}

/** One student's attendance for the current session. */
export async function studentAttendanceSummary(schoolId: string, studentId: string) {
  const win = await attendanceWindow(schoolId);
  const counts = (await attendanceTotals(schoolId, [studentId], win.min, win.max)).get(studentId)!;
  return { counts, percent: attendancePercent(counts), session: win.session };
}

/** A section's month: every day's marks plus per-student month and session totals. */
export async function loadRegister(schoolId: string, sectionId: string, month: string, win: Window) {
  const dates = monthDates(month);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const [days, holidays] = await Promise.all([
    db.attendanceDay.findMany({
      where: { sectionId, date: { gte: parseISODate(first)!, lte: parseISODate(last)! } },
      include: { records: { select: { studentId: true, status: true } } },
    }),
    schoolHolidays(schoolId, first, last),
  ]);
  // Current students, plus anyone marked here this month who has since left or moved.
  const markedIds = [...new Set(days.flatMap((d) => d.records.map((r) => r.studentId)))];
  const students = await db.student.findMany({
    where: { OR: [{ sectionId, status: "ACTIVE" }, { id: { in: markedIds } }] },
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
    select: { ...rosterSelect, sectionId: true, status: true },
  });

  const byDate = new Map(days.map((d) => [isoDate(d.date), d]));
  const marks = new Map<string, Map<string, AttendanceStatusKey>>(); // studentId → date → status
  const monthCounts = new Map(students.map((s) => [s.id, emptyCounts()]));
  let workingDays = 0;
  const daily = new Map<string, number>(); // date → present count
  for (const [date, day] of byDate) {
    if (day.holiday || holidays.has(date) || !day.records.length) continue;
    workingDays++;
    let present = 0;
    for (const r of day.records) {
      if (!marks.has(r.studentId)) marks.set(r.studentId, new Map());
      marks.get(r.studentId)!.set(date, r.status);
      monthCounts.get(r.studentId)![r.status]++;
      if (r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY") present++;
    }
    daily.set(date, present);
  }
  const sessionCounts = await attendanceTotals(schoolId, students.map((s) => s.id), win.min, win.max);

  return {
    dates,
    students: students.map((s) => ({
      ...s,
      name: fullName(s),
      moved: s.status !== "ACTIVE" || s.sectionId !== sectionId,
      marks: marks.get(s.id) ?? new Map<string, AttendanceStatusKey>(),
      month: monthCounts.get(s.id)!,
      monthPercent: attendancePercent(monthCounts.get(s.id)!),
      sessionPercent: attendancePercent(sessionCounts.get(s.id)!),
    })),
    classHolidays: new Map([...byDate].filter(([, d]) => d.holiday).map(([date, d]) => [date, d.holiday!])),
    schoolHolidays: holidays,
    workingDays,
    daily,
  };
}

export type Register = Awaited<ReturnType<typeof loadRegister>>;
