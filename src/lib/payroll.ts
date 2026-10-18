import "server-only";
import { daysOff } from "@/lib/attendance";
import { isoDate, monthDates, parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { computeSalary, lopAmount, type ComponentDef, type SlipLine } from "@/lib/payroll-shared";
import { loadPersonAttendance } from "@/lib/staff-register";
import { leaveBalance } from "@/lib/leave";
import { getCurrentSession } from "@/lib/sessions";
import { LEAVE_CATEGORIES, type LeaveCategoryKey } from "@/lib/leave-shared";

/** The school's active salary components, in order. */
export async function loadComponents(schoolId: string): Promise<ComponentDef[]> {
  const rows = await db.salaryComponent.findMany({ where: { schoolId, active: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, calc: c.calc, defaultValue: c.defaultValue }));
}

/** Each person's own component values, keyed "T:<teacherId>" / "S:<staffId>". */
export async function loadOwnValues(schoolId: string, person?: { teacherId: string } | { staffId: string }) {
  const rows = await db.salaryValue.findMany({ where: { schoolId, ...person }, select: { componentId: true, teacherId: true, staffId: true, value: true } });
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = r.teacherId ? `T:${r.teacherId}` : `S:${r.staffId}`;
    out.set(key, { ...out.get(key), [r.componentId]: r.value });
  }
  return out;
}

/**
 * Unpaid days in a month for every teacher and staff member, keyed "T:<id>" /
 * "S:<id>": absent days plus half of each half day, on working days up to
 * today, leaving out days on approved leave. The same rule as "Loss of pay" in
 * attendance.
 */
export async function monthLop(schoolId: string, month: string, today: string) {
  const dates = monthDates(month).filter((d) => d <= today);
  const out = new Map<string, number>();
  if (!dates.length) return out;
  const [from, to] = [dates[0], dates[dates.length - 1]];
  const range = { gte: parseISODate(from)!, lte: parseISODate(to)! };
  const [off, marks, leave] = await Promise.all([
    daysOff(schoolId, from, to),
    db.staffAttendance.findMany({ where: { schoolId, date: range, status: { in: ["ABSENT", "HALF_DAY"] } }, select: { date: true, status: true, teacherId: true, staffId: true } }),
    db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", applicant: { in: ["TEACHER", "STAFF"] }, fromDate: { lte: range.lte }, toDate: { gte: range.gte } },
      select: { teacherId: true, staffId: true, fromDate: true, toDate: true },
    }),
  ]);
  for (const m of marks) {
    const d = isoDate(m.date);
    if (off.has(d)) continue;
    const onLeave = leave.some((l) => (m.teacherId ? l.teacherId === m.teacherId : l.staffId === m.staffId) && d >= isoDate(l.fromDate) && d <= isoDate(l.toDate));
    if (onLeave) continue;
    const key = m.teacherId ? `T:${m.teacherId}` : `S:${m.staffId}`;
    out.set(key, (out.get(key) ?? 0) + (m.status === "ABSENT" ? 1 : 0.5));
  }
  return out;
}

/**
 * A person's salary for a month: their slip lines (with this month's one-time
 * items), and what unpaid days would take off. A day's pay for unpaid days
 * comes from the regular gross, without one-time items.
 */
export function monthSalary(
  basic: number | null,
  components: ComponentDef[],
  own: Record<string, number> | undefined,
  lopDays: number,
  month: string,
  oneTime: SlipLine[] = [],
) {
  if (!basic) return null;
  const pay = computeSalary(basic, components, own ?? {});
  const lop = lopAmount(pay.gross, lopDays, monthDates(month).length);
  const extraEarn = oneTime.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amount, 0);
  const extraDeduct = oneTime.filter((l) => l.kind === "DEDUCTION").reduce((n, l) => n + l.amount, 0);
  const gross = pay.gross + extraEarn;
  const deductions = pay.deductions + extraDeduct;
  return { lines: [...pay.lines, ...oneTime], gross, deductions, net: Math.max(0, gross - deductions), lopDays, lopAmount: lop, lopGross: pay.gross };
}

/** This month's one-time items as slip lines, keyed "T:<id>" / "S:<id>". */
export async function loadOneTimeItems(schoolId: string, month: string) {
  const rows = await db.salaryAdjustment.findMany({ where: { schoolId, month }, orderBy: { createdAt: "asc" } });
  const out = new Map<string, SlipLine[]>();
  for (const r of rows) {
    const key = r.teacherId ? `T:${r.teacherId}` : `S:${r.staffId}`;
    const line: SlipLine = { name: r.name, kind: r.kind, amount: r.amount, note: [r.note, "this month only"].filter(Boolean).join(" · ") };
    out.set(key, [...(out.get(key) ?? []), line]);
  }
  return out;
}

/**
 * A salary slip: the payment with its lines, who it was for, the school, the
 * month's attendance and leave taken by type, and (in the current session) the
 * leave balance. `teacherId` limits it to that teacher's own published slips.
 */
export async function loadPayslip(schoolId: string, paymentId: string, teacherId?: string) {
  const p = await db.salaryPayment.findFirst({
    where: { id: paymentId, schoolId, ...(teacherId && { teacherId, published: true }) },
    include: {
      teacher: { select: { employeeCode: true, specialization: true, joiningDate: true, email: true, phone: true } },
      staff: { select: { employeeCode: true, designation: true, department: true, joiningDate: true, email: true, phone: true } },
    },
  });
  if (!p) return null;
  const person = p.teacherId ? { teacherId: p.teacherId } : p.staffId ? { staffId: p.staffId } : null;
  const dates = monthDates(p.month);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const range = { gte: parseISODate(from)!, lte: parseISODate(to)! };
  const [school, register, off, monthLeave, session] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { id: true, name: true, address: true, phone: true, email: true, logo: { select: { updatedAt: true } } } }),
    person ? loadPersonAttendance(schoolId, person, from, to, [to, todayISO()].sort()[0], null) : null,
    daysOff(schoolId, from, to),
    person
      ? db.leaveRequest.findMany({ where: { schoolId, ...person, status: "APPROVED", fromDate: { lte: range.lte }, toDate: { gte: range.gte } }, select: { category: true, fromDate: true, toDate: true } })
      : [],
    getCurrentSession(schoolId),
  ]);
  // Approved leave this month by type, in working days.
  const leaveTaken: Partial<Record<LeaveCategoryKey, number>> = {};
  for (const l of monthLeave) {
    const n = dates.filter((d) => d >= isoDate(l.fromDate) && d <= isoDate(l.toDate) && !off.has(d)).length;
    if (n) leaveTaken[l.category] = (leaveTaken[l.category] ?? 0) + n;
  }
  // The session's leave balance, only for a slip in the current session (balances reset each session).
  const inSession = person && from >= isoDate(session.startDate) && to <= isoDate(session.endDate);
  const balance = inSession ? await leaveBalance(schoolId, p.teacherId ? "TEACHER" : "STAFF", (p.teacherId ?? p.staffId)!) : null;
  const month = register?.byMonth.find((m) => m.month === p.month);
  const lines = (Array.isArray(p.lines) ? p.lines : [{ name: "Salary", kind: "EARNING", amount: p.amount }]) as SlipLine[];
  const who = p.teacher ?? p.staff;
  return {
    id: p.id,
    month: p.month,
    name: p.name,
    role: p.role,
    code: who?.employeeCode ?? null,
    department: p.staff?.department ?? (p.teacher?.specialization ? `Teaching · ${p.teacher.specialization}` : p.teacherId ? "Teaching" : null),
    joined: who?.joiningDate ? isoDate(who.joiningDate) : null,
    contact: [who?.phone, who?.email].filter(Boolean).join(" · "),
    amount: p.amount,
    paidOn: isoDate(p.paidOn),
    mode: p.mode,
    note: p.note,
    lopDays: p.lopDays,
    lines,
    daysInMonth: dates.length,
    attendance: month
      ? { workingDays: month.workingDays, present: month.present, absent: month.absent, halfDay: month.halfDay, late: month.late, leave: month.leave, lop: month.lop }
      : null,
    leaveTaken: LEAVE_CATEGORIES.filter((c) => leaveTaken[c]).map((c) => ({ category: c, days: leaveTaken[c]! })),
    leaveBalance: balance ? { session: balance.session, rows: balance.rows.filter((r) => r.allowed != null) } : null,
    published: p.published ? { at: p.publishedAt?.toISOString() ?? null, by: p.publishedBy } : null,
    teacherId: p.teacherId,
    staffId: p.staffId,
    school: {
      name: school.name,
      address: school.address,
      contact: [school.phone, school.email].filter(Boolean).join(" · "),
      logoUrl: school.logo ? `/api/schools/${school.id}/logo?v=${school.logo.updatedAt.getTime()}` : null,
    },
  };
}

export type Payslip = NonNullable<Awaited<ReturnType<typeof loadPayslip>>>;
