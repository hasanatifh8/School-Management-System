import Link from "next/link";
import { CircleCheck, Info, Lightbulb, OctagonAlert, TriangleAlert, Users, Wallet, Zap, TrendingUp, type LucideIcon } from "lucide-react";
import { MonthPicker } from "@/components/expenses/month-picker";
import { StatusPill, budgetStatus, statusBar } from "@/components/expenses/status";
import { TrendChart } from "@/components/expenses/trend-chart";
import { Card, IconTile, Table, tbodyClass, tdClass, thClass, theadClass, type IconTone } from "@/components/ui";
import { addMonths } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { isMonth, monthSummary, recommendations, requireExpensesAccess, spendingTrend, type Tone } from "@/lib/expenses";
import { rupees } from "@/lib/fees-shared";

const TONES: Record<Tone, { icon: LucideIcon; cls: string }> = {
  critical: { icon: OctagonAlert, cls: "text-rose-600" },
  warning: { icon: TriangleAlert, cls: "text-amber-600" },
  info: { icon: Info, cls: "text-sky-600" },
  good: { icon: CircleCheck, cls: "text-emerald-600" },
};

/** The month at a glance: spent vs budget, forecast, trend, categories and advice. */
export default async function ExpensesOverviewPage({ searchParams }: PageProps<"/admin/expenses">) {
  const sp = await searchParams;
  const { school, today, month: current } = await requireExpensesAccess();
  const month = isMonth(sp.month) && sp.month <= addMonths(current, 1) ? sp.month : current;
  const [summary, trend, lastMonthUnpaid] = await Promise.all([
    monthSummary(school.id, month, today),
    spendingTrend(school.id, month),
    month === current
      ? db.salaryPayment
          .findMany({ where: { schoolId: school.id, month: addMonths(month, -1) }, select: { teacherId: true, staffId: true } })
          .then(async (paid) => {
            const paidIds = new Set(paid.map((p) => p.teacherId ?? p.staffId));
            // Only people who were already on the payroll last month.
            const before = { lt: new Date(`${month}-01T00:00:00Z`) };
            const [t, s] = await Promise.all([
              db.teacher.findMany({ where: { schoolId: school.id, status: "ACTIVE", monthlySalary: { gt: 0 }, createdAt: before }, select: { id: true } }),
              db.staffMember.findMany({ where: { schoolId: school.id, status: "ACTIVE", monthlySalary: { gt: 0 }, createdAt: before }, select: { id: true } }),
            ]);
            return paid.length ? [...t, ...s].filter((x) => !paidIds.has(x.id)).length : 0; // only once last month's payroll has started
          })
      : 0,
  ]);
  const { totals, rows, phase } = summary;
  const live = phase !== "past";
  const advice = recommendations(summary, lastMonthUnpaid);
  const overall = budgetStatus({ budget: totals.budget, spent: totals.spent, forecast: totals.forecast }, live);
  const used = totals.budget ? Math.min(100, (totals.spent / totals.budget) * 100) : 0;
  const expectedMark = totals.budget && live ? Math.min(100, (totals.forecast / totals.budget) * 100) : null;

  return (
    <div className="space-y-6">
      <MonthPicker basePath="/admin/expenses" month={month} max={addMonths(current, 1)} current={current} />

      {/* Budget meter */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{phase === "future" ? "Planned for the month" : phase === "past" ? "Spent" : "Spent so far"}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
              {rupees(totals.spent)}
              {totals.budget != null && <span className="ml-2 text-base font-normal text-slate-500">of {rupees(totals.budget)} budget</span>}
            </p>
          </div>
          <StatusPill status={overall} />
        </div>
        {totals.budget != null ? (
          <>
            <div className="relative mt-4 h-3 rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${statusBar(overall)}`} style={{ width: `${used}%` }} />
              {expectedMark != null && expectedMark > used && (
                <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-slate-500" style={{ left: `calc(${expectedMark}% - 1px)` }} title={`Expected by month end: ${rupees(totals.forecast)}`} />
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {totals.spent > totals.budget
                ? `${rupees(totals.spent - totals.budget)} over budget.`
                : `${rupees(totals.budget - totals.spent)} left this month.`}
              {live && ` Expected by month end: ${rupees(totals.forecast)}${totals.forecast > totals.budget ? ` (${rupees(totals.forecast - totals.budget)} over)` : ""}.`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            No budget set yet.{" "}
            <Link href="/admin/expenses/budget" className="font-medium text-indigo-600 hover:underline">
              Set monthly budgets
            </Link>{" "}
            to see if you are over or under.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat icon={Users} tone="indigo" label="Salaries paid" value={rupees(totals.teaching + totals.nonTeaching)} detail={`Teaching ${rupees(totals.teaching)} · Non-teaching ${rupees(totals.nonTeaching)}`} href={`/admin/expenses/salaries?month=${month}`} />
        <Stat icon={Zap} tone="amber" label="Other expenses" value={rupees(totals.spent - totals.teaching - totals.nonTeaching)} detail="Electricity, events, upkeep…" href={`/admin/expenses/list?month=${month}`} />
        <Stat icon={TrendingUp} tone="violet" label={live ? "Expected this month" : "Usual month"} value={rupees(live ? totals.forecast : totals.average)} detail={live ? `Next month about ${rupees(totals.next)}` : "Average of the 3 months before"} />
        <Stat icon={Wallet} tone="emerald" label="Fees collected" value={rupees(summary.feesCollected)} detail={`Net ${summary.feesCollected - totals.spent >= 0 ? "+" : "−"}${rupees(Math.abs(summary.feesCollected - totals.spent))} after spending`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Last 6 months" description="Total spending each month. Hover a bar for details." className="xl:col-span-3">
          <TrendChart data={trend} selected={month} />
        </Card>
        <Card title="Recommendations" icon={Lightbulb} className="xl:col-span-2" padded={false}>
          {advice.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Record some expenses and salaries to get advice here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {advice.map((a, i) => {
                const { icon: Icon, cls } = TONES[a.tone];
                return (
                  <li key={i} className="flex gap-3 px-6 py-3 text-sm text-slate-700">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
                    {a.text}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="By category" description="Budgets apply to every month. The usual amount is the average of the 3 months before." padded={false}>
        <Table>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Category</th>
              <th className={`${thClass} text-right`}>Budget</th>
              <th className={`${thClass} text-right`}>Spent</th>
              <th className={thClass}>Used</th>
              <th className={`${thClass} text-right`}>Usual</th>
              {live && <th className={`${thClass} text-right`}>Expected</th>}
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            {rows.map((c) => {
              const status = budgetStatus(c, live);
              const pct = c.budget ? Math.round((c.spent / c.budget) * 100) : null;
              return (
                <tr key={c.id}>
                  <td className={`${tdClass} font-medium text-slate-900`}>
                    <Link href={c.isSalaries ? `/admin/expenses/salaries?month=${month}` : `/admin/expenses/list?month=${month}&category=${c.id}`} className="hover:text-indigo-600">
                      {c.name}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{c.budget != null ? rupees(c.budget) : "—"}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>{rupees(c.spent)}</td>
                  <td className={`${tdClass} w-40`}>
                    {pct != null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${statusBar(status)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-slate-500">{pct}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums text-slate-500`}>{c.average ? rupees(c.average) : "—"}</td>
                  {live && <td className={`${tdClass} text-right tabular-nums`}>{rupees(c.forecast)}</td>}
                  <td className={tdClass}>
                    <StatusPill status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ icon, tone, label, value, detail, href }: { icon: LucideIcon; tone: IconTone; label: string; value: string; detail: string; href?: string }) {
  const body = (
    <>
      <IconTile icon={icon} tone={tone} />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </>
  );
  const cls = "block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-indigo-200 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
