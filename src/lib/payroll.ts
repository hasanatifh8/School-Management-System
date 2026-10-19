import "server-only";
import { daysOff } from "@/lib/attendance";
import { isoDate, monthDates, parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { NO_LOP, computeSalary, lopAmount, lopNote, lopTotal, readLopRule, slipFor, type ComponentDef, type LopCount, type LopRule, type MonthPay, type SlipLine } from "@/lib/payroll-shared";
import { fullName } from "@/lib/queries";
import { loadPersonAttendance } from "@/lib/staff-register";
import { leaveBalance } from "@/lib/leave";
import { getCurrentSession } from "@/lib/sessions";
import { LEAVE_CATEGORIES, type LeaveCategoryKey } from "@/lib/leave-shared";

/** The school's active salary components, in order. */
export async function loadComponents(schoolId: string): Promise<ComponentDef[]> {
  const rows = await db.salaryComponent.findMany({ where: { schoolId, active: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, calc: c.calc, defaultValue: c.defaultValue }));
}

/** How the school takes absent days off salaries (Settings → Payroll). */
export async function loadLopRule(schoolId: string) {
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { lopRule: true } });
  return readLopRule(school?.lopRule);
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
 * "S:<id>", by why, on working days up to today:
 * - absent days, and half of each half day, not on approved leave (the same
 *   rule as "Loss of pay" in attendance);
 * - approved leave over the school's monthly cap for its type, unless they
 *   were marked present that day;
 * - with the school's "count unmarked days" on: working days with no mark and
 *   no leave, from their joining date and from the month's first day of staff
 *   attendance (before attendance is taken at all, nothing counts).
 */
export async function monthLop(schoolId: string, month: string, today: string) {
  const dates = monthDates(month).filter((d) => d <= today);
  const out = new Map<string, LopCount>();
  if (!dates.length) return out;
  const [from, to] = [dates[0], dates[dates.length - 1]];
  const range = { gte: parseISODate(from)!, lte: parseISODate(to)! };
  const [off, marks, leave, rule, teachers, staff] = await Promise.all([
    daysOff(schoolId, from, to),
    db.staffAttendance.findMany({ where: { schoolId, date: range }, select: { date: true, status: true, teacherId: true, staffId: true } }),
    db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", applicant: { in: ["TEACHER", "STAFF"] }, fromDate: { lte: range.lte }, toDate: { gte: range.gte } },
      select: { teacherId: true, staffId: true, fromDate: true, toDate: true, overLimitDates: true },
    }),
    loadLopRule(schoolId),
    db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, joiningDate: true } }),
    db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, joiningDate: true } }),
  ]);
  const add = (key: string, why: keyof LopCount, n = 1) => {
    const c = out.get(key) ?? { ...NO_LOP };
    c[why] += n;
    out.set(key, c);
  };
  const keyOf = (r: { teacherId: string | null; staffId: string | null }) => (r.teacherId ? `T:${r.teacherId}` : `S:${r.staffId}`);
  const onLeave = (key: string, d: string) => leave.some((l) => keyOf(l) === key && d >= isoDate(l.fromDate) && d <= isoDate(l.toDate));
  // "key|date" for every day over a monthly cap.
  const overLimit = new Set(leave.flatMap((l) => l.overLimitDates.filter((d) => d >= from && d <= to && !off.has(d)).map((d) => `${keyOf(l)}|${d}`)));
  const marked = new Map(marks.map((m) => [`${keyOf(m)}|${isoDate(m.date)}`, m.status]));

  for (const m of marks) {
    const d = isoDate(m.date);
    const key = keyOf(m);
    if (off.has(d) || overLimit.has(`${key}|${d}`)) continue;
    if (m.status !== "ABSENT" && m.status !== "HALF_DAY") continue;
    if (!onLeave(key, d)) add(key, m.status === "ABSENT" ? "absent" : "halfDays");
  }
  for (const k of overLimit) {
    const status = marked.get(k);
    if (status === "PRESENT" || status === "LATE") continue;
    add(k.split("|")[0], status === "HALF_DAY" ? "halfDays" : "overLimit");
  }
  if (rule.countUnmarked && marks.length) {
    const firstMark = marks.reduce((m, r) => (isoDate(r.date) < m ? isoDate(r.date) : m), isoDate(marks[0].date));
    const people = [...teachers.map((t) => ({ key: `T:${t.id}`, joined: isoDate(t.joiningDate) })), ...staff.map((s) => ({ key: `S:${s.id}`, joined: s.joiningDate ? isoDate(s.joiningDate) : null }))];
    for (const p of people) {
      const since = [firstMark, p.joined ?? firstMark].sort().at(-1)!;
      for (const d of dates) {
        if (d < since || off.has(d) || marked.has(`${p.key}|${d}`) || overLimit.has(`${p.key}|${d}`) || onLeave(p.key, d)) continue;
        add(p.key, "unmarked");
      }
    }
  }
  return out;
}

/**
 * A person's salary for a month: their slip lines (with this month's one-time
 * items), and what unpaid days would take off under the school's rule. A
 * day's pay comes from the regular gross (or basic), without one-time items.
 */
export function monthSalary(
  basic: number | null,
  components: ComponentDef[],
  own: Record<string, number> | undefined,
  lop: LopCount | undefined,
  month: string,
  rule: LopRule,
  oneTime: SlipLine[] = [],
): MonthPay | null {
  if (!basic) return null;
  const pay = computeSalary(basic, components, own ?? {});
  const days = monthDates(month).length;
  const regular = { gross: pay.gross, basic };
  const count = lop ?? NO_LOP;
  const lopDays = lopTotal(count);
  const extraEarn = oneTime.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amount, 0);
  const extraDeduct = oneTime.filter((l) => l.kind === "DEDUCTION").reduce((n, l) => n + l.amount, 0);
  const gross = pay.gross + extraEarn;
  const deductions = pay.deductions + extraDeduct;
  return {
    lines: [...pay.lines, ...oneTime],
    gross,
    deductions,
    net: Math.max(0, gross - deductions),
    lopDays,
    lop: count,
    lopAmount: lopAmount(rule, regular, lopDays, days),
    lopNote: lopNote(rule, regular, count, days),
  };
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
 * What every slip shows besides its lines: the school, the month's attendance
 * (up to today), leave taken by type, and (in the current session) the leave
 * balance.
 */
async function slipDetails(schoolId: string, person: { teacherId: string } | { staffId: string } | null, monthKey: string) {
  const dates = monthDates(monthKey);
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
  const balance = inSession ? await leaveBalance(schoolId, "teacherId" in person ? "TEACHER" : "STAFF", "teacherId" in person ? person.teacherId : person.staffId) : null;
  const month = register?.byMonth.find((m) => m.month === monthKey);
  return {
    daysInMonth: dates.length,
    attendance: month
      ? {
          workingDays: month.workingDays,
          present: month.present,
          absent: month.absent,
          halfDay: month.halfDay,
          late: month.late,
          leave: month.leave,
          unmarked: month.unmarked,
          lop: month.lop,
        }
      : null,
    leaveTaken: LEAVE_CATEGORIES.filter((c) => leaveTaken[c]).map((c) => ({ category: c, days: leaveTaken[c]! })),
    // Types with a limit; a type limited to 0 days and never used isn't worth a line.
    leaveBalance: balance ? { session: balance.session, rows: balance.rows.filter((r) => r.allowed != null && (r.allowed > 0 || r.used > 0)) } : null,
    school: {
      name: school.name,
      address: school.address,
      contact: [school.phone, school.email].filter(Boolean).join(" · "),
      logoUrl: school.logo ? `/api/schools/${school.id}/logo?v=${school.logo.updatedAt.getTime()}` : null,
    },
  };
}

/**
 * A salary slip: the payment with its lines, who it was for, and the slip's
 * details (see slipDetails). `teacherId` limits it to that teacher's own
 * published slips.
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
    ...(await slipDetails(schoolId, person, p.month)),
    published: p.published ? { at: p.publishedAt?.toISOString() ?? null, by: p.publishedBy } : null,
    teacherId: p.teacherId,
    staffId: p.staffId,
  };
}

export type Payslip = NonNullable<Awaited<ReturnType<typeof loadPayslip>>>;

/** A slip as the slip page shows it: a saved one, or a preview of one not paid yet (no payment date or mode). */
export type SlipView = Omit<Payslip, "paidOn" | "mode"> & { paidOn: string | null; mode: Payslip["mode"] | null; preview?: { asOf: string; lopAmount: number } };

/**
 * The slip a person would get for a month not paid yet, worked out now from
 * their salary structure, the month's one-time items and unpaid days so far
 * (deducted, as when paying with "deduct unpaid days"). Mid-month, attendance
 * and unpaid days count up to today. Null when the person isn't found or has
 * no basic pay.
 */
export async function previewPayslip(schoolId: string, key: string, month: string): Promise<SlipView | null> {
  const [type, id] = [key.slice(0, 2), key.slice(2)];
  if ((type !== "T:" && type !== "S:") || !id) return null;
  const person = type === "T:" ? { teacherId: id } : { staffId: id };
  const today = todayISO();
  const [teacher, staff, components, own, lop, oneTime, rule] = await Promise.all([
    type === "T:"
      ? db.teacher.findFirst({
          where: { id, schoolId },
          select: { firstName: true, middleName: true, lastName: true, specialization: true, monthlySalary: true, employeeCode: true, joiningDate: true, email: true, phone: true },
        })
      : null,
    type === "S:"
      ? db.staffMember.findFirst({
          where: { id, schoolId },
          select: { name: true, designation: true, department: true, monthlySalary: true, employeeCode: true, joiningDate: true, email: true, phone: true },
        })
      : null,
    loadComponents(schoolId),
    loadOwnValues(schoolId, person),
    monthLop(schoolId, month, today),
    loadOneTimeItems(schoolId, month),
    loadLopRule(schoolId),
  ]);
  const who = teacher ?? staff;
  const pay = who && monthSalary(who.monthlySalary, components, own.get(key), lop.get(key), month, rule, oneTime.get(key));
  if (!who || !pay) return null;
  const amount = Math.max(0, pay.net - pay.lopAmount);
  const slip = slipFor(pay, true, amount);
  return {
    id: "",
    month,
    name: teacher ? fullName(teacher) : staff!.name,
    role: teacher ? (teacher.specialization ? `Teacher · ${teacher.specialization}` : "Teacher") : staff!.designation,
    code: who.employeeCode,
    department: staff ? staff.department : teacher!.specialization ? `Teaching · ${teacher!.specialization}` : "Teaching",
    joined: who.joiningDate ? isoDate(who.joiningDate) : null,
    contact: [who.phone, who.email].filter(Boolean).join(" · "),
    amount,
    paidOn: null,
    mode: null,
    note: null,
    lopDays: slip.lopDays,
    lines: slip.lines,
    ...(await slipDetails(schoolId, person, month)),
    published: null,
    teacherId: teacher ? id : null,
    staffId: staff ? id : null,
    preview: { asOf: [monthDates(month).at(-1)!, today].sort()[0], lopAmount: pay.lopAmount },
  };
}
