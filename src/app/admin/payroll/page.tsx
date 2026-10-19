import { CalendarPlus, CalendarX2, CircleCheck, CircleMinus, ClipboardCheck, Plane, Plus, Send, SlidersHorizontal, UserRoundX, Users } from "lucide-react";
import Link from "next/link";
import { MonthPicker } from "@/components/expenses/month-picker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { OneTimeItemForm } from "@/components/payroll/one-time-item-form";
import { OneTimeItems, type OneTimeItemRow } from "@/components/payroll/one-time-items";
import { PayrollRoster } from "@/components/payroll/payroll-roster";
import { ButtonLink, Card, PageHeader, ProgressBar, StatusTab, tabBarClass } from "@/components/ui";
import { addMonths, isoDate, monthDates, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { isMonth, loadPayroll, requireExpensesAccess } from "@/lib/expenses";
import { MONTH_NAMES, rupees } from "@/lib/fees-shared";
import { looksLikeAbsence, lopParts, type RosterRow } from "@/lib/payroll-shared";
import { loadComponents } from "@/lib/payroll";
import { addOneTimeItem, publishAllPayslips } from "./actions";

const profileOf = (type: "TEACHER" | "STAFF", id: string) => (type === "TEACHER" ? `/admin/teachers/${id}?tab=salary` : `/admin/staff/${id}?tab=salary`);

/**
 * A month's payroll in one place: pay salaries (one by one or many at once),
 * check the draft slips paying makes, and publish them so teachers and staff
 * can see them. One-time items (bonuses, advances) have their own tab.
 */
export default async function PayrollPage({ searchParams }: PageProps<"/admin/payroll">) {
  const sp = await searchParams;
  const { school, month: current, today } = await requireExpensesAccess();
  const month = isMonth(sp.month) && sp.month <= addMonths(current, 1) ? sp.month : current;
  const view = sp.view === "items" ? "items" : "salaries";
  const monthEnd = monthDates(month).at(-1)!;
  const [payroll, slips, adjustments, pendingLeave, components] = await Promise.all([
    loadPayroll(school.id, month),
    db.salaryPayment.findMany({ where: { schoolId: school.id, month }, select: { id: true, gross: true, amount: true } }),
    db.salaryAdjustment.findMany({ where: { schoolId: school.id, month }, orderBy: { createdAt: "desc" } }),
    // Staff leave in this month still waiting for a decision: until approved, those days aren't leave.
    db.leaveRequest.count({
      where: { schoolId: school.id, status: "PENDING", applicant: { in: ["TEACHER", "STAFF"] }, fromDate: { lte: parseISODate(monthEnd)! }, toDate: { gte: parseISODate(`${month}-01`)! } },
    }),
    loadComponents(school.id),
  ]);
  const absenceLike = components.filter((c) => c.kind === "DEDUCTION" && looksLikeAbsence(c.name));
  const slipGross = new Map(slips.map((s) => [s.id, s.gross ?? s.amount]));
  const itemsBy = new Map<string, number>();
  for (const a of adjustments) {
    const key = a.teacherId ? `T:${a.teacherId}` : `S:${a.staffId}`;
    itemsBy.set(key, (itemsBy.get(key) ?? 0) + 1);
  }

  const rows: RosterRow[] = payroll.map((r) => ({
    key: r.key,
    type: r.type,
    name: r.name,
    role: r.role,
    // "P:<paymentId>": paid, then their record was deleted.
    profileHref: r.key.startsWith("P:") ? null : profileOf(r.type, r.id),
    status: r.payment ? (r.payment.published ? "published" : "draft") : r.pay ? "unpaid" : "nosalary",
    gross: r.payment ? (slipGross.get(r.payment.id) ?? r.payment.amount) : (r.pay?.gross ?? 0),
    net: r.pay?.net ?? r.payment?.amount ?? 0,
    lopDays: r.pay?.lopDays ?? 0,
    unmarked: r.pay?.lop.unmarked ?? 0,
    lopWhy: r.pay ? lopParts(r.pay.lop) : "",
    lopAmount: r.pay?.lopAmount ?? 0,
    items: itemsBy.get(r.key) ?? 0,
    payment: r.payment && { id: r.payment.id, amount: r.payment.amount, paidOn: isoDate(r.payment.paidOn), mode: r.payment.mode, published: r.payment.published },
  }));
  const byKey = new Map(payroll.map((r) => [r.key, r]));
  const items: OneTimeItemRow[] = adjustments.map((a) => {
    const key = a.teacherId ? `T:${a.teacherId}` : `S:${a.staffId}`;
    const person = byKey.get(key);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      amount: a.amount,
      note: a.note,
      person: person?.name ?? "Removed person",
      profileHref: person ? profileOf(person.type, person.id) : null,
      onSlip: !!person?.payment,
    };
  });

  const monthName = `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  const due = rows.filter((r) => r.status !== "nosalary");
  const paid = due.filter((r) => r.payment);
  const drafts = rows.filter((r) => r.status === "draft");
  const paidTotal = paid.reduce((n, r) => n + r.payment!.amount, 0);
  const total = paidTotal + due.filter((r) => !r.payment).reduce((n, r) => n + Math.max(0, r.net - r.lopAmount), 0);
  const canAdd = month >= addMonths(current, -1) && month <= addMonths(current, 1);
  const base = `/admin/payroll?month=${month}`;
  // Before paying: what a payroll clerk checks first. Only for people not paid yet.
  const toPay = rows.filter((r) => r.status === "unpaid");
  const gaps = toPay.filter((r) => r.unmarked > 0);
  type Check = { icon: typeof CalendarX2; text: string; href: string | null; cta: string | null };
  const checks = ([
    gaps.length > 0 && {
      icon: CalendarX2,
      text: `${gaps.length} ${gaps.length === 1 ? "person has" : "people have"} ${gaps.reduce((n, r) => n + r.unmarked, 0)} working days with no attendance mark, counted as absent.`,
      href: `/admin/attendance/staff/register?month=${month}`,
      cta: "Check the register",
    },
    pendingLeave > 0 && {
      icon: Plane,
      text: `${pendingLeave} teacher or staff leave request${pendingLeave === 1 ? " is" : "s are"} still waiting. Decide them first, so leave days aren't treated as absences.`,
      href: "/admin/leave?status=pending&who=teacher",
      cta: "Decide leave",
    },
    absenceLike.length > 0 && {
      icon: CircleMinus,
      text: `${absenceLike.map((c) => `“${c.name}”`).join(", ")} ${absenceLike.length === 1 ? "is a deduction" : "are deductions"} taken off every month, whatever the attendance. Absences are deducted separately.`,
      href: "/admin/settings/payroll",
      cta: "Review components",
    },
    rows.some((r) => r.status === "nosalary") && {
      icon: UserRoundX,
      text: `${rows.filter((r) => r.status === "nosalary").length} with no salary set can't be paid.`,
      href: null,
      cta: null,
    },
  ] as (Check | false)[]).filter((c): c is Check => !!c);

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Pay salaries, check the draft slips paying makes, then publish them. A slip stays hidden from the employee until it's published."
        action={
          <ButtonLink href="/admin/settings/payroll" variant="secondary" icon={SlidersHorizontal}>
            Salary components
          </ButtonLink>
        }
      />

      {/* The month, and how far its payroll has got: paid, then published. */}
      <section className="mb-6 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MonthPicker basePath={view === "items" ? "/admin/payroll?view=items" : "/admin/payroll"} month={month} max={addMonths(current, 1)} current={current} />
          {drafts.length > 0 && (
            <ActionForm action={publishAllPayslips.bind(null, month)} compact className="flex flex-row-reverse items-center gap-2">
              <SubmitButton
                variant="secondary"
                icon={<Send className="h-4 w-4" />}
                confirm={`Publish all ${drafts.length} draft slip${drafts.length === 1 ? "" : "s"} for ${monthName}?`}
                confirmMessage="Teachers and staff will be able to see, print and download them."
              >
                Publish all drafts ({drafts.length})
              </SubmitButton>
            </ActionForm>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <p className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-muted">
                <span className="font-semibold tabular-nums text-fg">{rupees(paidTotal)}</span> paid of {rupees(total)}
              </span>
              <span className="text-xs text-muted">
                {paid.length} of {due.length} paid · {paid.length - drafts.length} published
              </span>
            </p>
            <ProgressBar value={total ? (paidTotal / total) * 100 : 0} tone={paid.length === due.length && due.length ? "success" : "accent"} label="Share of the month's payroll paid" />
          </div>
          <ol className="flex items-center gap-2 text-xs font-medium">
            {[
              { label: "Pay", done: due.length > 0 && paid.length === due.length },
              { label: "Check drafts", done: paid.length > 0 && drafts.length === 0 },
              { label: "Publish", done: due.length > 0 && paid.length === due.length && drafts.length === 0 },
            ].map((s, i) => (
              <li key={s.label} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${s.done ? "bg-success-soft text-success ring-success-line" : "bg-surface-2 text-muted ring-line"}`}>
                {s.done ? <CircleCheck className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
                {s.label}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {view === "salaries" && toPay.length > 0 && checks.length > 0 && (
        <section className="mb-6 rounded-2xl border border-warning-line bg-warning-soft/40 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <ClipboardCheck className="h-4 w-4 text-warning" /> Before you pay {monthName}
          </p>
          <ul className="mt-2 space-y-1.5">
            {checks.map((c) => (
              <li key={c.text} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2">
                <c.icon className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span className="min-w-0 flex-1">{c.text}</span>
                {c.href && (
                  <Link href={c.href} className="text-sm font-medium text-accent-text hover:underline">
                    {c.cta} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6 border-b border-line">
        <nav aria-label="Payroll views" className={tabBarClass}>
          <StatusTab replace href={base} active={view === "salaries"} label="Salaries" icon={Users} count={rows.length} />
          <StatusTab replace href={`${base}&view=items`} active={view === "items"} label="One-time items" icon={CalendarPlus} count={items.length} />
        </nav>
      </div>

      {view === "salaries" ? (
        <PayrollRoster key={month} rows={rows} month={month} monthName={monthName} today={today} payKey={typeof sp.pay === "string" ? sp.pay : undefined} />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <Card title={`One-time items · ${monthName}`} icon={CalendarPlus} description="Earnings or deductions for this month only, on top of the regular salary." padded={false}>
            <OneTimeItems items={items} />
          </Card>
          <Card title="Add an item" icon={Plus} description="A bonus, arrears or an advance recovered, for one person or a group.">
            {canAdd ? (
              <OneTimeItemForm
                action={addOneTimeItem.bind(null, month)}
                people={payroll.filter((r) => r.key[1] === ":" && (r.salary || r.payment)).map((r) => ({ key: r.key, name: r.name, role: r.role, paid: !!r.payment }))}
                monthName={monthName}
              />
            ) : (
              <p className="text-sm text-muted">One-time items can be added for last month, this month or next month.</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
