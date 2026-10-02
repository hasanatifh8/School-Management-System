import Link from "next/link";
import { Banknote, CircleCheck, Presentation, Undo2, Users } from "lucide-react";
import { MonthPicker } from "@/components/expenses/month-picker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, inputClass, PagedList, selectClass } from "@/components/ui";
import { addMonths, todayISO } from "@/lib/attendance-shared";
import { isMonth, loadPayroll, requireExpensesAccess } from "@/lib/expenses";
import { MODE_LABELS, MONTH_NAMES, PAYMENT_MODES, rupees } from "@/lib/fees-shared";
import { payAllSalaries, paySalary, undoSalary } from "../actions";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** One month's payroll, one category at a time: teaching or non-teaching staff (?group=). */
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

  const groups = [
    { type: "TEACHER" as const, key: "teaching", title: "Teaching staff", icon: Presentation },
    { type: "STAFF" as const, key: "non-teaching", title: "Non-teaching staff", icon: Users },
  ];
  const active = groups.find((g) => g.key === sp.group) ?? groups[0];
  const dueIn = unpaid.filter((r) => r.type === active.type);
  const href = (key: string) => `/admin/expenses/salaries?month=${month}&group=${key}`;

  return (
    <div className="space-y-6">
      <MonthPicker basePath={`/admin/expenses/salaries?group=${active.key}`} month={month} max={addMonths(current, 1)} current={current} />

      {/* One card per category; the chosen one is managed below. */}
      <div className="grid gap-4 md:grid-cols-2" role="tablist" aria-label="Staff category">
        {groups.map((g) => {
          const people = rows.filter((r) => r.type === g.type);
          const total = sum(people);
          const done = sum(paid, g.type);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const on = g.key === active.key;
          return (
            <Link
              key={g.key}
              href={href(g.key)}
              role="tab"
              aria-selected={on}
              scroll={false}
              className={`group rounded-2xl border p-5 shadow-card transition hover:-translate-y-px ${
                on ? "border-accent-line bg-accent-soft ring-2 ring-accent/30" : "border-line bg-surface hover:border-accent-line"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? "bg-accent text-white" : "bg-surface-3 text-fg-2"}`}>
                  <g.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fg">{g.title}</span>
                  <span className="block text-xs text-muted">
                    {people.length} {people.length === 1 ? "person" : "people"} · payroll {rupees(total)}
                  </span>
                </span>
                {on && <Badge tone="indigo">Selected</Badge>}
              </span>
              <span className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <span>
                  <span className="block text-xs text-muted">Paid</span>
                  <span className="font-semibold tabular-nums text-success">{rupees(done)}</span>
                </span>
                <span>
                  <span className="block text-xs text-muted">Still to pay</span>
                  <span className={`font-semibold tabular-nums ${sum(unpaid, g.type) ? "text-warning" : "text-fg"}`}>{rupees(sum(unpaid, g.type))}</span>
                </span>
              </span>
              <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-3">
                <span className={`block h-full rounded-full ${pct === 100 ? "bg-success-solid" : "bg-accent"}`} style={{ width: `${pct}%` }} />
              </span>
            </Link>
          );
        })}
      </div>

      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div>
          <p className="text-sm font-semibold text-fg">
            {active.title} · {monthName}
          </p>
          <p className="text-xs text-muted">
            Whole school: {rupees(sum(paid))} paid of {rupees(sum(rows))}
          </p>
        </div>
        {dueIn.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CircleCheck className="h-4 w-4" /> Everyone in {active.title.toLowerCase()} with a salary is paid for {monthName}.
          </p>
        ) : (
          <ActionForm action={payAllSalaries.bind(null, month, active.type)} className="flex flex-wrap items-end gap-2">
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
            <SubmitButton
              icon={<Banknote className="h-4 w-4" />}
              confirm={`Pay ${dueIn.length} ${active.title.toLowerCase()} their full monthly salary (${rupees(sum(dueIn))}) for ${monthName}?`}
            >
              Pay all {dueIn.length}
            </SubmitButton>
          </ActionForm>
        )}
      </section>

      {section(active.type, active.title)}
    </div>
  );
}
