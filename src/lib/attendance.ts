import "server-only";
import { db } from "@/lib/db";
import {
  addDays,
  addMonths,
  attendancePercent,
  datesBetween,
  emptyCounts,
  isSunday,
  isoDate,
  monthDates,
  parseISODate,
  todayISO,
  weekStart,
  type AttendanceCounts,
  type AttendanceStatusKey,
  type RegisterPeriod,
} from "@/lib/attendance-shared";
import { onLeave } from "@/lib/leave";
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

const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** "22 Sept – 28 Sept 2026", dropping the first year when both ends share it. */
function spanLabel(from: string, to: string) {
  if (from === to) return dayMonthYear.format(parseISODate(from)!);
  const first = from.slice(0, 4) === to.slice(0, 4) ? dayMonth : dayMonthYear;
  return `${first.format(parseISODate(from)!)} – ${dayMonthYear.format(parseISODate(to)!)}`;
}

type Params = Record<string, string | string[] | undefined>;

/** URL query for a register period, e.g. "period=week&week=2026-09-21". */
export function rangeQuery(q: { period: RegisterPeriod; week?: string; month?: string; from?: string; to?: string }) {
  const sp = new URLSearchParams({ period: q.period });
  if (q.period === "week" && q.week) sp.set("week", q.week);
  if (q.period === "month" && q.month) sp.set("month", q.month);
  if (q.period === "custom" && q.from && q.to) {
    sp.set("from", q.from);
    sp.set("to", q.to);
  }
  return sp.toString();
}

/**
 * The register's date range from the URL: ?period=week|month|year|custom with
 * week=, month=, or from= & to=. A bare ?month= (older links) means a month.
 * Everything is kept inside the current session up to today.
 */
export function pickRange(params: Params, win: Window) {
  const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const raw = get("period");
  const period: RegisterPeriod = raw === "week" || raw === "year" || raw === "custom" ? raw : "month";
  const clamp = (iso: string) => (iso < win.min ? win.min : iso > win.max ? win.max : iso);

  if (period === "week") {
    const anchor = parseISODate(get("week")) ? clamp(get("week")!) : win.max;
    const from = weekStart(anchor);
    const to = addDays(from, 6);
    return {
      period,
      from,
      to,
      label: spanLabel(from, to),
      query: rangeQuery({ period, week: from }),
      prev: from > weekStart(win.min) ? rangeQuery({ period, week: addDays(from, -7) }) : null,
      next: from < weekStart(win.max) ? rangeQuery({ period, week: addDays(from, 7) }) : null,
    };
  }
  if (period === "year") {
    return { period, from: win.min, to: win.max, label: `Session ${win.session.name}`, query: rangeQuery({ period }), prev: null, next: null };
  }
  if (period === "custom") {
    let from = parseISODate(get("from")) ? clamp(get("from")!) : clamp(addDays(win.max, -29));
    let to = parseISODate(get("to")) ? clamp(get("to")!) : win.max;
    if (from > to) [from, to] = [to, from];
    return { period, from, to, label: spanLabel(from, to), query: rangeQuery({ period, from, to }), prev: null, next: null };
  }
  const month = pickMonth(get("month"), win);
  const days = monthDates(month);
  return {
    period,
    from: days[0],
    to: days[days.length - 1],
    label: monthYear.format(parseISODate(days[0])!),
    query: rangeQuery({ period, month }),
    prev: month > win.min.slice(0, 7) ? rangeQuery({ period, month: addMonths(month, -1) }) : null,
    next: month < win.max.slice(0, 7) ? rangeQuery({ period, month: addMonths(month, 1) }) : null,
  };
}

export type RegisterRange = ReturnType<typeof pickRange>;

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
  const [{ students, day, holiday }, leave] = await Promise.all([loadAttendanceSheet(schoolId, sectionId, date), onLeave(schoolId, parseISODate(date)!)]);
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
    /** Students on approved leave this day: they start as Leave on an unmarked day. */
    onLeave: students.filter((s) => leave.has(s.id)).map((s) => s.id),
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

/**
 * A section's attendance over a date range: every day's marks, per-student
 * totals for the range and for each month in it, and the session percentage.
 */
export async function loadRegister(schoolId: string, sectionId: string, from: string, to: string, win: Window) {
  const dates = datesBetween(from, to);
  const [days, holidays] = await Promise.all([
    db.attendanceDay.findMany({
      where: { sectionId, date: { gte: parseISODate(from)!, lte: parseISODate(to)! } },
      include: { records: { select: { studentId: true, status: true } } },
    }),
    schoolHolidays(schoolId, from, to),
  ]);
  // Current students, plus anyone marked here in the range who has since left or moved.
  const markedIds = [...new Set(days.flatMap((d) => d.records.map((r) => r.studentId)))];
  const students = await db.student.findMany({
    where: { OR: [{ sectionId, status: "ACTIVE" }, { id: { in: markedIds } }] },
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
    select: { ...rosterSelect, sectionId: true, status: true },
  });

  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const byDate = new Map(days.map((d) => [isoDate(d.date), d]));
  const marks = new Map<string, Map<string, AttendanceStatusKey>>(); // studentId → date → status
  const periodCounts = new Map(students.map((s) => [s.id, emptyCounts()]));
  const monthCounts = new Map(students.map((s) => [s.id, new Map(months.map((m) => [m, emptyCounts()]))]));
  let workingDays = 0;
  const workingByMonth = new Map(months.map((m) => [m, 0]));
  const daily = new Map<string, number>(); // date → attending count
  for (const [date, day] of byDate) {
    if (day.holiday || holidays.has(date) || !day.records.length) continue;
    workingDays++;
    workingByMonth.set(date.slice(0, 7), (workingByMonth.get(date.slice(0, 7)) ?? 0) + 1);
    let present = 0;
    for (const r of day.records) {
      if (!marks.has(r.studentId)) marks.set(r.studentId, new Map());
      marks.get(r.studentId)!.set(date, r.status);
      periodCounts.get(r.studentId)![r.status]++;
      monthCounts.get(r.studentId)!.get(date.slice(0, 7))![r.status]++;
      if (r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY") present++;
    }
    daily.set(date, present);
  }
  const sessionCounts = await attendanceTotals(schoolId, students.map((s) => s.id), win.min, win.max);

  return {
    from,
    to,
    dates,
    months,
    students: students.map((s) => ({
      ...s,
      name: fullName(s),
      moved: s.status !== "ACTIVE" || s.sectionId !== sectionId,
      marks: marks.get(s.id) ?? new Map<string, AttendanceStatusKey>(),
      period: periodCounts.get(s.id)!,
      periodPercent: attendancePercent(periodCounts.get(s.id)!),
      monthPercent: new Map(months.map((m) => [m, attendancePercent(monthCounts.get(s.id)!.get(m)!)])),
      sessionPercent: attendancePercent(sessionCounts.get(s.id)!),
    })),
    classHolidays: new Map([...byDate].filter(([, d]) => d.holiday).map(([date, d]) => [date, d.holiday!])),
    schoolHolidays: holidays,
    workingDays,
    workingByMonth,
    daily,
  };
}

export type Register = Awaited<ReturnType<typeof loadRegister>>;

/** Student filters for the register: ?q= (name, ID or roll) and ?band=below75|below90|full|none. */
export const REGISTER_BANDS = [
  { value: "below75", label: "Below 75%" },
  { value: "below90", label: "Below 90%" },
  { value: "full", label: "100% attendance" },
  { value: "none", label: "Not marked yet" },
] as const;

export function filterRegisterStudents<T extends { name: string; studentCode: string; rollNumber: number | null; periodPercent: number | null }>(
  students: T[],
  params: Params,
) {
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const band = typeof params.band === "string" ? params.band : "";
  const words = q.split(/\s+/).filter(Boolean);
  return students.filter((s) => {
    const p = s.periodPercent;
    if (band === "below75" && !(p != null && p < 75)) return false;
    if (band === "below90" && !(p != null && p < 90)) return false;
    if (band === "full" && p !== 100) return false;
    if (band === "none" && p != null) return false;
    return words.every((w) => s.name.toLowerCase().includes(w) || s.studentCode.toLowerCase().includes(w) || String(s.rollNumber ?? "") === w);
  });
}

/**
 * Every class's attendance over a date range, for the school-wide register:
 * working days, average of students' percentages, students below 75% and
 * total absences. Students count under their current class.
 */
export async function loadClassSummaries(schoolId: string, from: string, to: string) {
  const holidays = await schoolHolidays(schoolId, from, to);
  const dayWhere = {
    schoolId,
    holiday: null,
    date: { gte: parseISODate(from)!, lte: parseISODate(to)!, notIn: [...holidays.keys()].map((d) => parseISODate(d)!) },
  };
  const [sections, days, records] = await Promise.all([
    db.section.findMany({
      where: { class: { schoolId } },
      orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
      include: {
        class: true,
        classTeacher: { select: { firstName: true, middleName: true, lastName: true } },
        students: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    }),
    db.attendanceDay.groupBy({ by: ["sectionId"], where: { ...dayWhere, records: { some: {} } }, _count: true }),
    db.attendanceRecord.groupBy({ by: ["studentId", "status"], where: { day: dayWhere }, _count: true }),
  ]);
  const counts = new Map<string, AttendanceCounts>();
  for (const r of records) {
    if (!counts.has(r.studentId)) counts.set(r.studentId, emptyCounts());
    counts.get(r.studentId)![r.status] += r._count;
  }
  const working = new Map(days.map((d) => [d.sectionId, d._count]));

  return sections.map((s) => {
    const percents = s.students.map((st) => attendancePercent(counts.get(st.id) ?? emptyCounts())).filter((p): p is number => p != null);
    return {
      id: s.id,
      label: `${s.class.name} – ${s.name}`,
      classId: s.classId,
      classTeacher: s.classTeacher ? fullName(s.classTeacher) : null,
      students: s.students.length,
      workingDays: working.get(s.id) ?? 0,
      average: percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null,
      below75: percents.filter((p) => p < 75).length,
      absences: s.students.reduce((n, st) => n + (counts.get(st.id)?.ABSENT ?? 0), 0),
    };
  });
}

export type ClassSummary = Awaited<ReturnType<typeof loadClassSummaries>>[number];
