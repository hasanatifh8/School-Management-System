import "server-only";
// Daily leave roster and proxy (substitute) teachers: who is away on a date,
// the timetable periods their absence leaves uncovered, and who is free to
// take each one.
import { isoDate, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { leaveDays, staffDepartment, teacherDepartment, type LeaveCategoryKey } from "@/lib/leave-shared";
import { fullName, sectionLabel } from "@/lib/queries";
import { getPeriods } from "@/lib/timetable";

/** 1 = Monday … 7 = Sunday, as in the timetable. */
export const timetableDay = (date: string) => parseISODate(date)!.getUTCDay() || 7;

export type AwayPerson = {
  id: string;
  kind: "TEACHER" | "STAFF";
  name: string;
  code: string;
  department: string;
  /** Approved leave covering the date, if any. */
  leave: { category: LeaveCategoryKey; from: string; to: string; days: number } | null;
  /** Marked absent (or on leave) in staff attendance that day. */
  marked: "ABSENT" | "ON_LEAVE" | null;
};

export type ProxyPeriod = {
  slotId: string;
  period: { id: string; name: string; startTime: string; endTime: string };
  section: string;
  subject: string;
  proxy: { id: string; teacherId: string; name: string } | null;
};

export type FreeTeacher = { id: string; name: string; department: string; load: number };

/**
 * Teachers and staff away on a date (approved leave, or marked absent / on
 * leave), and for each teacher the periods to cover with any proxy already set.
 */
export async function proxyDay(schoolId: string, date: string) {
  const d = parseISODate(date)!;
  const day = timetableDay(date);
  const [leave, marks, teachers, staff, periods, slots, proxies, school] = await Promise.all([
    db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", applicant: { in: ["TEACHER", "STAFF"] }, fromDate: { lte: d }, toDate: { gte: d } },
      select: { teacherId: true, staffId: true, category: true, fromDate: true, toDate: true },
    }),
    db.staffAttendance.findMany({ where: { schoolId, date: d, status: { in: ["ABSENT", "ON_LEAVE"] } }, select: { teacherId: true, staffId: true, status: true } }),
    db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    getPeriods(schoolId),
    db.timetableSlot.findMany({
      where: { day, section: { class: { schoolId } } },
      include: { subject: true, section: { include: { class: true } } },
    }),
    db.proxyAssignment.findMany({ where: { schoolId, date: d }, include: { proxyTeacher: { select: { firstName: true, middleName: true, lastName: true } } } }),
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timetableDays: true } }),
  ]);

  const leaveOf = new Map(leave.map((l) => [(l.teacherId ?? l.staffId)!, l]));
  const markOf = new Map(marks.map((m) => [(m.teacherId ?? m.staffId)!, m.status as "ABSENT" | "ON_LEAVE"]));
  const awayIds = new Set([...leaveOf.keys(), ...markOf.keys()]);
  const toLeave = (id: string) => {
    const l = leaveOf.get(id);
    if (!l) return null;
    const from = isoDate(l.fromDate);
    const to = isoDate(l.toDate);
    return { category: l.category, from, to, days: leaveDays(from, to) };
  };

  const away: AwayPerson[] = [
    ...teachers
      .filter((t) => awayIds.has(t.id))
      .map((t) => ({ id: t.id, kind: "TEACHER" as const, name: fullName(t), code: t.employeeCode, department: teacherDepartment(t), leave: toLeave(t.id), marked: markOf.get(t.id) ?? null })),
    ...staff
      .filter((s) => awayIds.has(s.id))
      .map((s) => ({ id: s.id, kind: "STAFF" as const, name: s.name, code: s.employeeCode, department: staffDepartment(s), leave: toLeave(s.id), marked: markOf.get(s.id) ?? null })),
  ];

  // Periods each away teacher leaves uncovered (only on a school day, only real periods).
  const order = new Map(periods.map((p, i) => [p.id, i]));
  const period = new Map(periods.map((p) => [p.id, p]));
  const schoolDay = school.timetableDays.includes(day);
  const proxyBySlot = new Map(proxies.map((p) => [p.slotId, p]));
  const toCover = new Map<string, ProxyPeriod[]>();
  for (const s of schoolDay ? slots : []) {
    if (!s.teacherId || !awayIds.has(s.teacherId) || !period.has(s.periodId) || period.get(s.periodId)!.isBreak) continue;
    const p = proxyBySlot.get(s.id);
    const list = toCover.get(s.teacherId) ?? [];
    list.push({
      slotId: s.id,
      period: period.get(s.periodId)!,
      section: sectionLabel(s.section),
      subject: s.subject?.name ?? s.label ?? "",
      proxy: p ? { id: p.id, teacherId: p.proxyTeacherId, name: fullName(p.proxyTeacher) } : null,
    });
    toCover.set(s.teacherId, list);
  }
  for (const list of toCover.values()) list.sort((a, b) => order.get(a.period.id)! - order.get(b.period.id)!);

  // Free teachers per period: present, not teaching then, not already a proxy then.
  const busy = new Map<string, Set<string>>(); // periodId → teacher ids
  const load = new Map<string, number>(); // teacher id → periods that day (own + proxies)
  const mark = (periodId: string, teacherId: string) => {
    if (!busy.has(periodId)) busy.set(periodId, new Set());
    busy.get(periodId)!.add(teacherId);
    load.set(teacherId, (load.get(teacherId) ?? 0) + 1);
  };
  for (const s of slots) if (s.teacherId) mark(s.periodId, s.teacherId);
  const slotPeriod = new Map(slots.map((s) => [s.id, s.periodId]));
  for (const p of proxies) if (slotPeriod.has(p.slotId)) mark(slotPeriod.get(p.slotId)!, p.proxyTeacherId);
  const free: Record<string, FreeTeacher[]> = {};
  for (const p of periods) {
    free[p.id] = teachers
      .filter((t) => !awayIds.has(t.id) && !busy.get(p.id)?.has(t.id))
      .map((t) => ({ id: t.id, name: fullName(t), department: teacherDepartment(t), load: load.get(t.id) ?? 0 }))
      .sort((a, b) => a.load - b.load || a.name.localeCompare(b.name));
  }

  return {
    schoolDay,
    away,
    toCover: Object.fromEntries(toCover) as Record<string, ProxyPeriod[]>,
    free,
    covered: proxies.length,
    uncovered: [...toCover.values()].flat().filter((p) => !p.proxy).length,
  };
}

export type ProxyDay = Awaited<ReturnType<typeof proxyDay>>;

/** A teacher's proxy periods on a date, for their own dashboard. */
export async function myProxies(teacherId: string, date: string) {
  const rows = await db.proxyAssignment.findMany({
    where: { proxyTeacherId: teacherId, date: parseISODate(date)! },
    include: {
      slot: { include: { period: true, subject: true, section: { include: { class: true } } } },
      absentTeacher: { select: { firstName: true, middleName: true, lastName: true } },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      period: r.slot.period,
      section: sectionLabel(r.slot.section),
      subject: r.slot.subject?.name ?? r.slot.label ?? "",
      forTeacher: fullName(r.absentTeacher),
    }))
    .sort((a, b) => a.period.sortOrder - b.period.sortOrder || a.period.startTime.localeCompare(b.period.startTime));
}
