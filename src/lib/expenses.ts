import "server-only";
import { addMonths, monthDates, parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName } from "@/lib/queries";
import { getCurrentSchool, getViewer } from "@/lib/school";

/** Expenses are for school admins and Power Admin only. */
export async function requireExpensesAccess() {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  const today = todayISO();
  return { school, today, month: today.slice(0, 7), who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" };
}

export const DEFAULT_CATEGORIES = [
  "Electricity",
  "Water",
  "Events & functions",
  "Maintenance & repairs",
  "Stationery & supplies",
  "Transport & fuel",
  "Internet & phone",
  "Cleaning & housekeeping",
  "Other",
];

/** The school's categories, creating "Salaries" and the usual ones the first time. */
export async function ensureCategories(schoolId: string) {
  const existing = await db.expenseCategory.findMany({ where: { schoolId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  if (existing.some((c) => c.isSalaries)) return existing;
  await db.expenseCategory.createMany({
    data: [
      { schoolId, name: "Salaries", isSalaries: true, sortOrder: 0 },
      ...DEFAULT_CATEGORIES.filter((n) => !existing.some((c) => c.name === n)).map((name, i) => ({ schoolId, name, sortOrder: i + 1 })),
    ],
    skipDuplicates: true,
  });
  return db.expenseCategory.findMany({ where: { schoolId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function monthBounds(month: string) {
  const dates = monthDates(month);
  return { from: parseISODate(dates[0])!, to: parseISODate(dates[dates.length - 1])!, days: dates.length };
}

/* ───────────────────────── Payroll ───────────────────────── */

export type PayrollRow = {
  key: string; // "T:<id>" or "S:<id>"
  type: "TEACHER" | "STAFF";
  id: string;
  name: string;
  role: string;
  salary: number | null;
  payment: { id: string; amount: number; paidOn: Date; mode: string; note: string | null } | null;
};

/** Everyone to pay this month: active teachers and staff, plus anyone already paid for it. */
export async function loadPayroll(schoolId: string, month: string): Promise<PayrollRow[]> {
  const [teachers, staff, payments] = await Promise.all([
    db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }], select: { id: true, firstName: true, middleName: true, lastName: true, specialization: true, monthlySalary: true } }),
    db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ name: "asc" }] }),
    db.salaryPayment.findMany({ where: { schoolId, month } }),
  ]);
  const byTeacher = new Map(payments.filter((p) => p.teacherId).map((p) => [p.teacherId!, p]));
  const byStaff = new Map(payments.filter((p) => p.staffId).map((p) => [p.staffId!, p]));
  const pick = (p: (typeof payments)[number] | undefined) => (p ? { id: p.id, amount: p.amount, paidOn: p.paidOn, mode: p.mode, note: p.note } : null);

  const rows: PayrollRow[] = [
    ...teachers.map((t) => ({ key: `T:${t.id}`, type: "TEACHER" as const, id: t.id, name: fullName(t), role: t.specialization ? `Teacher · ${t.specialization}` : "Teacher", salary: t.monthlySalary, payment: pick(byTeacher.get(t.id)) })),
    ...staff.map((s) => ({ key: `S:${s.id}`, type: "STAFF" as const, id: s.id, name: s.name, role: s.designation, salary: s.monthlySalary, payment: pick(byStaff.get(s.id)) })),
  ];
  // People paid this month who have since left (or whose record was deleted).
  const listed = new Set(rows.map((r) => r.key));
  for (const p of payments) {
    const key = p.teacherId ? `T:${p.teacherId}` : p.staffId ? `S:${p.staffId}` : `P:${p.id}`;
    if (!listed.has(key)) rows.push({ key, type: p.payeeType, id: p.teacherId ?? p.staffId ?? p.id, name: p.name, role: p.role, salary: null, payment: pick(p) });
  }
  return rows;
}

/* ───────────────────────── Month summary & forecast ───────────────────────── */

async function spentByCategory(schoolId: string, month: string, salariesId: string) {
  const { from, to } = monthBounds(month);
  const [expenses, salaries] = await Promise.all([
    db.expense.groupBy({ by: ["categoryId"], where: { schoolId, date: { gte: from, lte: to } }, _sum: { amount: true } }),
    db.salaryPayment.groupBy({ by: ["payeeType"], where: { schoolId, month }, _sum: { amount: true } }),
  ]);
  const map = new Map(expenses.map((e) => [e.categoryId, e._sum.amount ?? 0]));
  const teaching = salaries.find((s) => s.payeeType === "TEACHER")?._sum.amount ?? 0;
  const nonTeaching = salaries.find((s) => s.payeeType === "STAFF")?._sum.amount ?? 0;
  map.set(salariesId, teaching + nonTeaching);
  return { map, teaching, nonTeaching };
}

export type CategorySummary = {
  id: string;
  name: string;
  isSalaries: boolean;
  budget: number | null;
  spent: number;
  average: number; // last 3 months
  forecast: number; // expected by month end
  next: number; // expected next month
};

export type Tone = "critical" | "warning" | "good" | "info";
export type Recommendation = { tone: Tone; text: string };

/**
 * Spending for a month against budget, with forecasts:
 * - Salaries: paid so far + salaries still to pay this month.
 * - Other categories: what's spent so far, or the usual monthly amount (the
 *   average of the previous 3 months) if that is higher and the month isn't over.
 * - Next month: this month's payroll + each category's recent average.
 */
export async function monthSummary(schoolId: string, month: string, today: string) {
  const categories = await ensureCategories(schoolId);
  const salaries = categories.find((c) => c.isSalaries)!;
  const current = today.slice(0, 7);
  const phase = month < current ? "past" : month === current ? "current" : "future";
  const history = [1, 2, 3].map((n) => addMonths(month, -n));

  const [now, ...previous] = await Promise.all([spentByCategory(schoolId, month, salaries.id), ...history.map((m) => spentByCategory(schoolId, m, salaries.id))]);
  const payroll = await loadPayroll(schoolId, month);
  const unpaid = payroll.filter((r) => !r.payment && r.salary);
  const salaryDue = unpaid.reduce((n, r) => n + r.salary!, 0);
  const payrollTotal = payroll.reduce((n, r) => n + (r.payment?.amount ?? r.salary ?? 0), 0);

  // "Usual" = average over the previous 3 months that have any spending recorded,
  // so months before the school started using this don't drag it down.
  const recorded = previous.filter((p) => [...p.map.values()].some((v) => v > 0));
  const avgOf = (id: string, months = recorded) => (months.length ? months.reduce((n, p) => n + (p.map.get(id) ?? 0), 0) / months.length : 0);

  const rows: CategorySummary[] = categories.map((c) => {
    const spent = now.map.get(c.id) ?? 0;
    const average = Math.round(avgOf(c.id));
    let forecast = spent;
    if (c.isSalaries) forecast = phase === "past" ? spent : spent + salaryDue;
    else if (phase !== "past") forecast = Math.max(spent, average);
    // Next month: the last two recorded months plus this month's forecast, averaged.
    const lastTwo = recorded.slice(0, 2);
    const next = c.isSalaries
      ? payroll.reduce((n, r) => n + (r.salary ?? r.payment?.amount ?? 0), 0)
      : Math.round((lastTwo.reduce((n, p) => n + (p.map.get(c.id) ?? 0), 0) + forecast) / (lastTwo.length + 1));
    return { id: c.id, name: c.name, isSalaries: c.isSalaries, budget: c.monthlyBudget, spent, average, forecast, next };
  });

  const sum = (f: (r: CategorySummary) => number) => rows.reduce((n, r) => n + f(r), 0);
  const budgeted = rows.filter((r) => r.budget != null);
  const totals = {
    spent: sum((r) => r.spent),
    budget: budgeted.length ? budgeted.reduce((n, r) => n + r.budget!, 0) : null,
    forecast: sum((r) => r.forecast),
    next: sum((r) => r.next),
    average: sum((r) => r.average),
    teaching: now.teaching,
    nonTeaching: now.nonTeaching,
  };

  const { from, to, days } = monthBounds(month);
  const fees = await db.feeReceipt.aggregate({ where: { schoolId, cancelledAt: null, date: { gte: from, lte: to } }, _sum: { total: true } });
  const feesCollected = fees._sum.total ?? 0;
  const dayOfMonth = phase === "current" ? Number(today.slice(8, 10)) : phase === "past" ? days : 0;

  return { month, phase, rows, totals, payroll, unpaid, salaryDue, payrollTotal, feesCollected, daysLeft: days - dayOfMonth, missingSalary: payroll.filter((r) => !r.salary && !r.payment) };
}

export type MonthSummary = Awaited<ReturnType<typeof monthSummary>>;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const r = (n: number) => inr.format(n);

/** Plain-language advice from the numbers, most urgent first. */
export function recommendations(s: MonthSummary, previousUnpaid: number): Recommendation[] {
  const out: Recommendation[] = [];
  const live = s.phase !== "past";

  for (const c of s.rows) {
    if (c.budget == null) continue;
    if (c.spent > c.budget) {
      out.push({ tone: "critical", text: `${c.name} is ${r(c.spent - c.budget)} over its ${r(c.budget)} budget (${Math.round((c.spent / Math.max(1, c.budget)) * 100)}% used).` });
    } else if (live && c.forecast > c.budget) {
      out.push({ tone: "warning", text: `${c.name} is likely to go over budget: expected ${r(c.forecast)} against ${r(c.budget)}.` });
    } else if (live && c.budget > 0 && c.spent / c.budget >= 0.85) {
      out.push({ tone: "warning", text: `${c.name} has used ${Math.round((c.spent / c.budget) * 100)}% of its budget with ${s.daysLeft} day(s) left.` });
    }
  }

  if (s.totals.budget != null) {
    const expected = live ? s.totals.forecast : s.totals.spent;
    if (expected > s.totals.budget) {
      out.push({ tone: "critical", text: `${live ? "At this pace, total spending will reach" : "Total spending was"} ${r(expected)}, ${r(expected - s.totals.budget)} over the ${r(s.totals.budget)} monthly budget.` });
    } else {
      out.push({ tone: "good", text: `${live ? "Expected total" : "Total spending"} ${r(expected)} is within the ${r(s.totals.budget)} budget (${r(s.totals.budget - expected)} to spare).` });
    }
  }

  for (const c of s.rows) {
    if (c.isSalaries || c.average < 500) continue;
    const compare = live ? c.forecast : c.spent;
    if (compare > c.average * 1.3) {
      out.push({ tone: "warning", text: `${c.name} is ${Math.round((compare / c.average - 1) * 100)}% above its usual ${r(c.average)} a month. Worth checking why.` });
    } else if (!live && c.spent > 0 && c.spent < c.average * 0.7) {
      out.push({ tone: "good", text: `${c.name} came in ${Math.round((1 - c.spent / c.average) * 100)}% below its usual ${r(c.average)}.` });
    }
  }

  if (live && s.unpaid.length) {
    out.push({ tone: "info", text: `${s.unpaid.length} salar${s.unpaid.length === 1 ? "y" : "ies"} (${r(s.salaryDue)}) still to pay this month.` });
  }
  if (previousUnpaid) out.push({ tone: "warning", text: `${previousUnpaid} salar${previousUnpaid === 1 ? "y is" : "ies are"} still unpaid for last month.` });
  if (s.missingSalary.length) {
    out.push({ tone: "info", text: `${s.missingSalary.length} ${s.missingSalary.length === 1 ? "person has" : "people have"} no monthly salary set, so the forecast leaves them out.` });
  }

  const noBudget = s.rows.filter((c) => c.budget == null && (c.spent > 0 || c.average > 0));
  if (noBudget.length) out.push({ tone: "info", text: `Set a budget for ${noBudget.map((c) => c.name).join(", ")} to track ${noBudget.length === 1 ? "it" : "them"}. The Budget page suggests amounts from recent spending.` });

  if (s.feesCollected > 0) {
    const spent = s.totals.spent;
    if (spent > s.feesCollected) out.push({ tone: "warning", text: `Spending so far (${r(spent)}) is more than the fees collected this month (${r(s.feesCollected)}).` });
    else out.push({ tone: "info", text: `Fees collected this month: ${r(s.feesCollected)}. Spending so far is ${Math.round((spent / s.feesCollected) * 100)}% of that.` });
  }

  if (live) out.push({ tone: "info", text: `Next month is expected to cost about ${r(s.totals.next)} (payroll plus each category's recent average).` });

  const order: Record<Tone, number> = { critical: 0, warning: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

/** Total spent and total budget for the `count` months ending at `month`. */
export async function spendingTrend(schoolId: string, month: string, count = 6) {
  const categories = await ensureCategories(schoolId);
  const salaries = categories.find((c) => c.isSalaries)!;
  const budget = categories.some((c) => c.monthlyBudget != null) ? categories.reduce((n, c) => n + (c.monthlyBudget ?? 0), 0) : null;
  const months = Array.from({ length: count }, (_, i) => addMonths(month, i - count + 1));
  const spent = await Promise.all(
    months.map(async (m) => {
      const s = await spentByCategory(schoolId, m, salaries.id);
      return [...s.map.values()].reduce((n, v) => n + v, 0);
    }),
  );
  return months.map((m, i) => ({ month: m, spent: spent[i], budget }));
}

/** Budget suggestion from the last 3 months: the average plus 10%, rounded up to ₹500. */
export async function suggestedBudgets(schoolId: string, month: string) {
  const categories = await ensureCategories(schoolId);
  const salaries = categories.find((c) => c.isSalaries)!;
  const history = (await Promise.all([1, 2, 3].map((n) => spentByCategory(schoolId, addMonths(month, -n), salaries.id)))).filter((h) =>
    [...h.map.values()].some((v) => v > 0),
  );
  const payroll = await loadPayroll(schoolId, month);
  const payrollTotal = payroll.reduce((n, r) => n + (r.salary ?? 0), 0);
  return new Map(
    categories.map((c) => {
      const avg = history.length ? history.reduce((n, h) => n + (h.map.get(c.id) ?? 0), 0) / history.length : 0;
      const base = c.isSalaries ? Math.max(payrollTotal, avg) : avg * 1.1;
      return [c.id, base > 0 ? Math.ceil(base / 500) * 500 : null];
    }),
  );
}
