import "server-only";
// Monthly attendance register for teaching or non-teaching staff: one row per
// person, one column per day, and totals including loss of pay (LOP).
import { schoolHolidays } from "@/lib/attendance";
import { isSunday, isoDate, monthDates, parseISODate } from "@/lib/attendance-shared";
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
 * One month of a staff group's attendance. Working days are the month's days
 * up to `today` that are neither Sundays nor school holidays.
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
    schoolHolidays(schoolId, from, to),
    db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", [key]: { not: null }, fromDate: { lte: range.lte }, toDate: { gte: range.gte } },
      select: { teacherId: true, staffId: true, fromDate: true, toDate: true },
    }),
  ]);

  const working = dates.filter((d) => d <= today && !isSunday(d) && !holidays.has(d));
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
    const onLeave = leaveDates.get(p.id) ?? new Set<string>();
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0 };
    for (const d of working) if (m[d]) c[m[d]]++;
    const leaveDays = working.filter((d) => !m[d] && onLeave.has(d));
    const leaveTotal = c.ON_LEAVE + leaveDays.length;
    // Approved leave isn't held against attendance: it is left out of the percentage.
    const counted = c.PRESENT + c.LATE + c.HALF_DAY + c.ABSENT;
    return {
      ...p,
      marks: m,
      leaveDays,
      present: c.PRESENT + c.LATE + c.HALF_DAY / 2,
      absent: c.ABSENT,
      late: c.LATE,
      halfDay: c.HALF_DAY,
      leave: leaveTotal,
      lop: c.ABSENT + c.HALF_DAY / 2,
      percent: counted ? Math.round(((c.PRESENT + c.LATE + c.HALF_DAY / 2) / counted) * 1000) / 10 : null,
    };
  });

  return { month, dates, working, holidays: new Map([...holidays].map(([d, h]) => [d, h.name])), rows };
}

export type StaffRegister = Awaited<ReturnType<typeof loadStaffRegister>>;
