import Link from "next/link";
import { Banknote, CalendarPlus, CircleCheck, EyeOff, FilePen, FileText, Presentation, Send, SlidersHorizontal, Trash2, Users, Wallet } from "lucide-react";
import { MonthPicker } from "@/components/expenses/month-picker";
import { OneTimeItemForm } from "@/components/payroll/one-time-item-form";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Callout, Card, EmptyState, PageHeader, PagedList, StatCard, StatGrid, buttonVariants } from "@/components/ui";
import { addMonths } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { isMonth, loadPayroll, requireExpensesAccess } from "@/lib/expenses";
import { MODE_LABELS, MONTH_NAMES, rupees } from "@/lib/fees-shared";
import { dayCount } from "@/lib/payroll-shared";
import { addOneTimeItem, publishAllPayslips, publishPayslip, removeOneTimeItem, unpublishPayslip } from "./actions";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * A month's salary slips. Paying a salary makes a draft slip; the admin checks
 * or edits it and publishes it. Teachers see only published slips.
 */
export default async function PayrollPage({ searchParams }: PageProps<"/admin/payroll">) {
  const sp = await searchParams;
  const { school, month: current } = await requireExpensesAccess();
  const month = isMonth(sp.month) && sp.month <= addMonths(current, 1) ? sp.month : current;
  const [slips, payroll, items] = await Promise.all([
    db.salaryPayment.findMany({
      where: { schoolId: school.id, month },
      orderBy: [{ payeeType: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        payeeType: true,
        amount: true,
        gross: true,
        lopDays: true,
        paidOn: true,
        mode: true,
        published: true,
        publishedAt: true,
      },
    }),
    loadPayroll(school.id, month),
    db.salaryAdjustment.findMany({ where: { schoolId: school.id, month }, orderBy: { createdAt: "desc" } }),
  ]);
  const byKey = new Map(payroll.map((r) => [r.key, r]));
  const canAdd = month >= addMonths(current, -1) && month <= addMonths(current, 1);
  const monthName = `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  const drafts = slips.filter((s) => !s.published);
  const unpaid = payroll.filter((r) => !r.payment && r.salary).length;
  const total = slips.reduce((n, s) => n + s.amount, 0);

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Salary slips for teachers and staff. Check or edit each slip, then publish it; a slip stays hidden from the employee until it's published."
        action={
          <>
            <ButtonLink href="/admin/settings/payroll" variant="secondary" icon={SlidersHorizontal}>
              Salary components
            </ButtonLink>
            <ButtonLink href={`/admin/expenses/salaries?month=${month}`} icon={Banknote}>
              Pay salaries
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker basePath="/admin/payroll" month={month} max={addMonths(current, 1)} current={current} />
        {drafts.length > 0 && (
          <ActionForm action={publishAllPayslips.bind(null, month)} compact className="flex flex-row-reverse items-center gap-2">
            <SubmitButton
              icon={<Send className="h-4 w-4" />}
              confirm={`Publish ${drafts.length} draft slip${drafts.length === 1 ? "" : "s"} for ${monthName}?`}
              confirmMessage="Teachers and staff will be able to see, print and download them."
            >
              Publish all {drafts.length} drafts
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      <div className="mb-6">
        <StatGrid>
          <StatCard icon={FileText} tone="indigo" label="Slips" value={slips.length} detail={monthName} />
          <StatCard icon={CircleCheck} tone="emerald" label="Published" value={slips.length - drafts.length} detail="Visible to the employee" />
          <StatCard icon={FilePen} tone={drafts.length ? "amber" : "slate"} label="Drafts" value={drafts.length} detail="Hidden until published" />
          <StatCard
            icon={Wallet}
            tone="sky"
            label="Net paid"
            value={rupees(total)}
            detail={unpaid ? `${unpaid} still to pay` : "Everyone with a salary is paid"}
            href={unpaid ? `/admin/expenses/salaries?month=${month}` : undefined}
          />
        </StatGrid>
      </div>

      {drafts.length > 0 && (
        <Callout icon={EyeOff} tone="warning" className="mb-6">
          {drafts.length} slip{drafts.length === 1 ? " is a draft" : "s are drafts"}: teachers and staff can&apos;t see {drafts.length === 1 ? "it" : "them"}{" "}
          yet. Open a slip to check it, edit it if something is wrong, then publish.
        </Callout>
      )}

      <Card
        className="mb-6"
        title={`One-time items · ${monthName}`}
        icon={CalendarPlus}
        description="Earnings or deductions for this month only, on top of the regular salary: a bonus, arrears, an advance recovered."
        padded={false}
      >
        {items.length > 0 && (
          <ul className="divide-y divide-line border-b border-line">
            {items.map((it) => {
              const person = byKey.get(it.teacherId ? `T:${it.teacherId}` : `S:${it.staffId}`);
              const paid = !!person?.payment;
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {it.name} <span className="font-normal text-muted">· {person?.name ?? "Removed person"}</span>
                    </span>
                    {it.note && <span className="block truncate text-xs text-muted">{it.note}</span>}
                  </span>
                  <span className={`font-semibold tabular-nums ${it.kind === "DEDUCTION" ? "text-danger" : "text-success"}`}>
                    {it.kind === "DEDUCTION" ? "−" : "+"}
                    {rupees(it.amount)}
                  </span>
                  {paid ? (
                    <Badge tone="green">On the slip</Badge>
                  ) : (
                    <>
                      <Badge tone="amber">Added when paid</Badge>
                      <ActionForm action={removeOneTimeItem.bind(null, it.id)} compact className="flex flex-row-reverse items-center gap-2">
                        <SubmitButton
                          variant="dangerGhost"
                          size="sm"
                          confirm={`Remove ${it.name} for ${person?.name ?? "this person"}?`}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          <span className="sr-only">Remove</span>
                        </SubmitButton>
                      </ActionForm>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="p-4 sm:p-6">
          {canAdd ? (
            <OneTimeItemForm
              action={addOneTimeItem.bind(null, month)}
              people={payroll
                .filter((r) => r.key[1] === ":" && (r.salary || r.payment))
                .map((r) => ({ key: r.key, name: r.name, role: r.role, paid: !!r.payment }))}
              monthName={monthName}
            />
          ) : (
            <p className="text-sm text-muted">One-time items can be added for last month, this month or next month.</p>
          )}
        </div>
      </Card>

      <Card title={`Salary slips · ${monthName}`} icon={Users} padded={false}>
        {slips.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No salary slips this month"
            description="A slip is made when you pay a salary. Pay salaries for this month first."
            action={
              <ButtonLink href={`/admin/expenses/salaries?month=${month}`} icon={Banknote} size="sm" variant="secondary">
                Pay salaries
              </ButtonLink>
            }
          />
        ) : (
          <PagedList pageSize={20} noun="slips">
            {slips.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-fg-2">
                  {s.payeeType === "TEACHER" ? <Presentation className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </span>
                <Link href={`/admin/payslips/${s.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg hover:text-accent-text">{s.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {s.role} · paid {dateFmt.format(s.paidOn)} · {MODE_LABELS[s.mode]}
                    {s.lopDays ? ` · ${dayCount(s.lopDays)} unpaid` : ""}
                  </span>
                </Link>
                <span className="text-right tabular-nums">
                  <span className="block font-semibold text-fg">{rupees(s.amount)}</span>
                  {s.gross && s.gross !== s.amount ? <span className="block text-xs text-muted">of {rupees(s.gross)}</span> : null}
                </span>
                {s.published ? (
                  <Badge tone="green" dot>
                    Published
                  </Badge>
                ) : (
                  <Badge tone="amber" dot>
                    Draft
                  </Badge>
                )}
                <span className="flex items-center gap-1">
                  <Link href={`/admin/payslips/${s.id}`} className={`${buttonVariants.ghost} h-8 px-2.5 text-xs`}>
                    <FileText className="h-3.5 w-3.5" /> View
                  </Link>
                  {!s.published && (
                    <Link href={`/admin/payslips/${s.id}/edit`} className={`${buttonVariants.ghost} h-8 px-2.5 text-xs`}>
                      <FilePen className="h-3.5 w-3.5" /> Edit
                    </Link>
                  )}
                  {s.published ? (
                    <ActionForm action={unpublishPayslip.bind(null, s.id)} compact className="flex flex-row-reverse items-center gap-2">
                      <SubmitButton
                        variant="ghost"
                        size="sm"
                        icon={<EyeOff className="h-3.5 w-3.5" />}
                        confirm={`Unpublish ${s.name}'s slip?`}
                        confirmMessage="It goes back to draft and they can't see it until you publish it again."
                      >
                        Unpublish
                      </SubmitButton>
                    </ActionForm>
                  ) : (
                    <ActionForm action={publishPayslip.bind(null, s.id)} compact className="flex flex-row-reverse items-center gap-2">
                      <SubmitButton variant="secondary" size="sm" icon={<Send className="h-3.5 w-3.5" />}>
                        Publish
                      </SubmitButton>
                    </ActionForm>
                  )}
                </span>
              </li>
            ))}
          </PagedList>
        )}
      </Card>
    </>
  );
}
