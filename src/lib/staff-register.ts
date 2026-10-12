import "server-only";
// Monthly attendance register for teaching or non-teaching staff: one row per
// person, one column per day, and totals including loss of pay (LOP).
import { daysOff } from "@/lib/attendance";
import { addMonths, isoDate, monthDates, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName } from "@/lib/queries";
import type { StaffGroup, StaffStatusKey } from "@/lib/staff-attendance-shared";

export type StaffRegisterRow = {
  id: string;
  name: string;
  code: string;
  department: string;
  marks: Record<string, StaffStatusKey>;
  /** Unmarked working days covered by approved leave (shown as LV, not counted as absent). */
  leaveDays: string[];
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  /** Absent days plus half of each half day: unpaid. */
  lop: number;
  percent: number | null;
};

/**
 * Totals for one person over some working days: present (late counts, a half
 * day is half), absent, late, half days, leave and loss of pay (absent days
 * plus half of each half day). Approved leave on an unmarked day shows as
 * leave; leave isn't held against attendance, so it is left out of the %.
 */
export function tallyStaff(working: string[], marks: Record<string, StaffStatusKey>, onLeave: Set<string>) {
  const c = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0 };
  for (const d of working) if (marks[d]) c[marks[d]]++;
  const leaveDays = working.filter((d) => !marks[d] && onLeave.has(d));
  const counted = c.PRESENT + c.LATE + c.HALF_DAY + c.ABSENT;
  return {
    leaveDays,
    present: c.PRESENT + c.LATE + c.HALF_DAY / 2,
    absent: c.ABSENT,
    late: c.LATE,
    halfDay: c.HALF_DAY,
    leave: c.ON_LEAVE + leaveDays.length,
    lop: c.ABSENT + c.HALF_DAY / 2,
    /** Working days with no mark and no leave. */
    unmarked: working.filter((d) => !marks[d] && !onLeave.has(d)).length,
    percent: counted ? Math.round(((c.PRESENT + c.LATE + c.HALF_DAY / 2) / counted) * 1000) / 10 : null,
  };
}

/**
 * One month of a staff group's attendance. Working days are the month's days
 * up to `today` that are neither weekly offs nor school holidays.
 */
export async function loadStaffRegister(schoolId: string, group: StaffGroup, month: string, today: string) {
  const dates = monthDates(month);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const teaching = group === "teaching";
  const key = teaching ? "teacherId" : "staffId";
  const range = { gte: parseISODate(from)!, lte: parseISODate(to)! };

  const [people, records, holidays, leave] = await Promise.all([
    teaching
      ? db.teacher
          .findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] })
          .then((ts) => ts.map((t) => ({ id: t.id, name: fullName(t), code: t.employeeCode, department: t.specialization ?? "" })))
      : db.staffMember
          .findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { name: "asc" } })
          .then((ss) => ss.map((s) => ({ id: s.id, name: s.name, code: s.employeeCode, department: [s.designation, s.department].filter(Boolean).join(" · ") }))),
    db.staffAttendance.findMany({ where: { schoolId, date: range, [key]: { not: null } }, select: { teacherId: true, staffId: true, date: true, status: true } }),
    daysOff(schoolId, from, to),
    db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", [key]: { not: null }, fromDate: { lte: range.lte }, toDate: { gte: range.gte } },
      select: { teacherId: true, staffId: true, fromDate: true, toDate: true },
    }),
  ]);

  const working = dates.filter((d) => d <= today && !holidays.has(d));
  const marks = new Map<string, Record<string, StaffStatusKey>>();
  for (const r of records) {
    const id = (r.teacherId ?? r.staffId)!;
    if (!marks.has(id)) marks.set(id, {});
    marks.get(id)![isoDate(r.date)] = r.status;
  }
  const leaveDates = new Map<string, Set<string>>();
  for (const l of leave) {
    const id = (l.teacherId ?? l.staffId)!;
    if (!leaveDates.has(id)) leaveDates.set(id, new Set());
    for (const d of working) if (d >= isoDate(l.fromDate) && d <= isoDate(l.toDate)) leaveDates.get(id)!.add(d);
  }

  const rows: StaffRegisterRow[] = people.map((p) => {
    const m = marks.get(p.id) ?? {};
    return { ...p, marks: m, ...tallyStaff(working, m, leaveDates.get(p.id) ?? new Set<string>()) };
  });

  return { month, dates, working, holidays: new Map([...holidays].map(([d, h]) => [d, h.name])), rows };
}

export type StaffRegister = Awaited<ReturnType<typeof loadStaffRegister>>;

/**
 * One teacher's or staff member's attendance from `from` to `to` (days after
 * `today` are not working days yet): every day's mark, approved leave, the
 * holidays, and totals for the whole range and for each month in it.
 * Working days start at the later of the person's joining date and the first
 * day the school marked any staff attendance, so days before either aren't
 * counted as "not marked".
 */
export async function loadPersonAttendance(
  schoolId: string,
  person: { teacherId: string } | { staffId: string },
  from: string,
  to: string,
  today: string,
  joined: string | null,
) {
  const range = { gte: parseISODate(from)!, lte: parseISODate(to)! };
  const [records, holidays, leave, first] = await Promise.all([
    db.staffAttendance.findMany({ where: { schoolId, date: range, ...person }, select: { date: true, status: true, remark: true } }),
    daysOff(schoolId, from, to),
    db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", ...person, fromDate: { lte: range.lte }, toDate: { gte: range.gte } },
      select: { fromDate: true, toDate: true, category: true },
    }),
    db.staffAttendance.aggregate({ where: { schoolId, date: range }, _min: { date: true } }),
  ]);
  const firstMark = first._min.date ? isoDate(first._min.date) : null;
  const since = [from, joined, firstMark ?? today].filter((d): d is string => !!d).sort().at(-1)!;
  const marks: Record<string, StaffStatusKey> = {};
  const remarks: Record<string, string> = {};
  for (const r of records) {
    marks[isoDate(r.date)] = r.status;
    if (r.remark) remarks[isoDate(r.date)] = r.remark;
  }
  const months: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) months.push(m);
  const dates = months.flatMap((m) => monthDates(m)).filter((d) => d >= from && d <= to);
  const working = dates.filter((d) => d >= since && d <= today && !holidays.has(d));
  const onLeave = new Set(working.filter((d) => leave.some((l) => d >= isoDate(l.fromDate) && d <= isoDate(l.toDate))));
  return {
    since,
    marks,
    remarks,
    onLeave,
    holidays: new Map([...holidays].map(([d, h]) => [d, h.name])),
    working,
    total: tallyStaff(working, marks, onLeave),
    byMonth: months.map((month) => {
      const days = working.filter((d) => d.startsWith(month));
      return { month, workingDays: days.length, ...tallyStaff(days, marks, onLeave) };
    }),
  };
}

export type PersonAttendance = Awaited<ReturnType<typeof loadPersonAttendance>>;
