import Link from "next/link";
import { Banknote, CircleCheck, Undo2, Users } from "lucide-react";
import { MonthPicker } from "@/components/expenses/month-picker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, inputClass, PagedList, selectClass } from "@/components/ui";
import { addMonths, todayISO } from "@/lib/attendance-shared";
import { isMonth, loadPayroll, requireExpensesAccess } from "@/lib/expenses";
import { MODE_LABELS, MONTH_NAMES, PAYMENT_MODES, rupees } from "@/lib/fees-shared";
import { payAllSalaries, paySalary, undoSalary } from "../actions";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** One month's payroll: teaching and non-teaching staff, paid or not. */
export default async function SalariesPage({ searchParams }: PageProps<"/admin/expenses/salaries">) {
  const sp = await searchParams;
  const { school, month: current } = await requireExpensesAccess();
  const month = isMonth(sp.month) && sp.month <= addMonths(current, 1) ? sp.month : current;
  const rows = await loadPayroll(school.id, month);
  const today = todayISO();
  const monthName = `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  const paid = rows.filter((r) => r.payment);
  const unpaid = rows.filter((r) => !r.payment && r.salary);
  const sum = (list: typeof rows, type?: string) => list.filter((r) => !type || r.type === type).reduce((n, r) => n + (r.payment?.amount ?? r.salary ?? 0), 0);

  const section = (type: "TEACHER" | "STAFF", title: string) => {
    const list = rows.filter((r) => r.type === type);
    return (
      <Card title={title} description={`${list.length} people · paid ${rupees(sum(paid, type))} · to pay ${rupees(sum(unpaid, type))}`} icon={Users} padded={false}>
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title={type === "TEACHER" ? "No teachers" : "No non-teaching staff yet"}
            action={
              type === "STAFF" && (
                <Link href="/admin/staff" className="text-sm font-medium text-accent-text">
                  Add staff
                </Link>
              )
            }
          />
        ) : (
          <PagedList pageSize={15} noun="people">
            {list.map((r) => (
              <li key={r.key} className="px-6 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">{r.name}</p>
                    <p className="text-xs text-muted">{r.role}</p>
                  </div>
                  <p className="text-sm tabular-nums text-muted">
                    {r.salary ? (
                      `${rupees(r.salary)}/mo`
                    ) : !r.payment ? (
                      <Link href={r.type === "TEACHER" ? `/admin/teachers/${r.id}` : "/admin/staff"} className="text-warning underline">
                        Set salary
                      </Link>
                    ) : null}
                  </p>
                  {r.payment ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="green">
                        <CircleCheck className="h-3 w-3" />
                        {rupees(r.payment.amount)} · {dateFmt.format(r.payment.paidOn)} · {MODE_LABELS[r.payment.mode as keyof typeof MODE_LABELS]}
                      </Badge>
                      <ActionForm action={undoSalary.bind(null, r.payment.id)} compact className="flex flex-row-reverse items-center gap-2">
                        <SubmitButton variant="ghost" size="sm" confirm={`Remove ${r.name}'s ${monthName} salary payment?`} icon={<Undo2 className="h-4 w-4" />}>
                          <span className="sr-only">Undo payment for {r.name}</span>
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  ) : (
                    <Badge tone="amber">Unpaid</Badge>
                  )}
                </div>
                {!r.payment && r.key[1] === ":" && (
                  <details className="mt-2">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent-text underline-offset-4 hover:underline">
                      <Banknote className="h-3.5 w-3.5" /> Pay {r.name.split(" ")[0]}
                    </summary>
                    <ActionForm action={paySalary.bind(null, r.key, month)} className="mt-2 flex flex-wrap items-end gap-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-fg-2">Amount (₹)</span>
                        <input name="amount" inputMode="numeric" defaultValue={r.salary ?? ""} required className={`${inputClass} !w-32 !py-2`} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-fg-2">Paid on</span>
                        <input type="date" name="paidOn" defaultValue={today} max={today} required className={`${inputClass} !py-2`} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-fg-2">Mode</span>
                        <select name="mode" defaultValue="BANK_TRANSFER" className={`${selectClass} !w-40 !py-2`}>
                          {PAYMENT_MODES.map((m) => (
                            <option key={m} value={m}>
                              {MODE_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block min-w-40 flex-1">
                        <span className="mb-1 block text-xs font-medium text-fg-2">Note</span>
                        <input name="note" maxLength={200} placeholder="e.g. 2 days leave deducted" className={`${inputClass} !py-2`} />
                      </label>
                      <SubmitButton size="sm">Mark paid</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </li>
            ))}
          </PagedList>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <MonthPicker basePath="/admin/expenses/salaries" month={month} max={addMonths(current, 1)} current={current} />

      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <dl className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-muted">Payroll for {monthName}</dt>
            <dd className="text-xl font-semibold tabular-nums text-fg">{rupees(sum(rows))}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Paid</dt>
            <dd className="text-xl font-semibold tabular-nums text-success">{rupees(sum(paid))}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Teaching / non-teaching paid</dt>
            <dd className="text-sm font-medium tabular-nums text-fg">
              {rupees(sum(paid, "TEACHER"))} / {rupees(sum(paid, "STAFF"))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Still to pay</dt>
            <dd className={`text-xl font-semibold tabular-nums ${unpaid.length ? "text-warning" : "text-fg"}`}>
              {rupees(sum(unpaid))} <span className="text-xs font-normal text-muted">({unpaid.length})</span>
            </dd>
          </div>
        </dl>
        {unpaid.length === 0 && paid.length > 0 && (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CircleCheck className="h-4 w-4" /> Everyone with a salary is paid for {monthName}.
          </p>
        )}
        {unpaid.length > 0 && (
          <ActionForm action={payAllSalaries.bind(null, month)} className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-2">Paid on</span>
              <input type="date" name="paidOn" defaultValue={today} max={today} required className={`${inputClass} !py-2`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-2">Mode</span>
              <select name="mode" defaultValue="BANK_TRANSFER" className={`${selectClass} !w-40 !py-2`}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton icon={<Banknote className="h-4 w-4" />} confirm={`Pay ${unpaid.length} people their full monthly salary (${rupees(sum(unpaid))}) for ${monthName}?`}>
              Pay all {unpaid.length}
            </SubmitButton>
          </ActionForm>
        )}
      </section>

      {section("TEACHER", "Teaching staff")}
      {section("STAFF", "Non-teaching staff")}
    </div>
  );
}
