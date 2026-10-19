import Link from "next/link";
import { CalendarPlus, CalendarRange, CircleAlert, Eye, EyeOff, FilePen, FileText, History, ReceiptText, Send, SlidersHorizontal, Wallet } from "lucide-react";
import { MonthPicker } from "@/components/expenses/month-picker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { OneTimeItems } from "@/components/payroll/one-time-items";
import { PayslipHistory } from "@/components/payroll/payslip-history";
import { AddOneTimeItemButton, PayPersonButton, PersonalComponentButton } from "@/components/payroll/salary-actions";
import { SalaryBreakdown } from "@/components/payroll/salary-breakdown";
import { SalaryStructureForm } from "@/components/payroll/salary-structure-form";
import { Badge, ButtonLink, Card, EmptyState, StatCard, StatGrid, cx, type BadgeTone } from "@/components/ui";
import { addMonths, isoDate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { isMonth } from "@/lib/expenses";
import { MODE_LABELS, MONTH_NAMES, rupees } from "@/lib/fees-shared";
import { loadComponents, loadOwnValues, previewPayslip } from "@/lib/payroll";
import { computeSalary, dayCount, type SlipLine } from "@/lib/payroll-shared";
import { saveSalaryStructure } from "@/app/admin/settings/payroll/actions";
import { publishPayslip, unpublishPayslip } from "@/app/admin/payroll/actions";

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthLabel = (m: string) => `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const totals = (lines: SlipLine[]) => {
  const gross = lines.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amount, 0);
  const deductions = lines.filter((l) => l.kind === "DEDUCTION").reduce((n, l) => n + l.amount, 0);
  return { lines, gross, deductions, net: Math.max(0, gross - deductions) };
};

type View = "month" | "structure" | "history";

/**
 * A teacher's or staff member's Salary tab, in three views:
 * - month: one month's pay (paid slip or a preview), with pay/publish and one-time items;
 * - structure: basic pay, their component values, and components just for them;
 * - history: every slip, filtered and paged.
 */
export async function SalaryTab({
  schoolId,
  person,
  name,
  basic,
  base,
  view: requested,
  month: monthParam,
}: {
  schoolId: string;
  person: { teacherId: string } | { staffId: string };
  name: string;
  basic: number | null;
  /** The Salary tab's URL, e.g. "/admin/teachers/<id>?tab=salary". */
  base: string;
  view?: string | string[];
  month?: string | string[];
}) {
  const key = "teacherId" in person ? `T:${person.teacherId}` : `S:${person.staffId}`;
  const view: View = requested === "structure" || requested === "history" ? requested : "month";
  const today = todayISO();
  const current = today.slice(0, 7);
  const month = isMonth(monthParam) && monthParam <= addMonths(current, 1) ? monthParam : current;
  const first = name.split(" ")[0];

  const [components, own, payments] = await Promise.all([
    loadComponents(schoolId),
    loadOwnValues(schoolId, person),
    db.salaryPayment.findMany({ where: { schoolId, ...person }, orderBy: [{ month: "desc" }, { createdAt: "desc" }] }),
  ]);
  const salary = basic ? computeSalary(basic, components, own.get(key) ?? {}) : null;
  const paidMonths = new Set(payments.map((p) => p.month));
  const sessionPaid = payments.filter((p) => p.month.slice(0, 4) === current.slice(0, 4)).reduce((n, p) => n + p.amount, 0);
  const last = payments[0];
  const thisMonth = payments.find((p) => p.month === current);
  // One-time items can go on last, this or next month, if not paid yet.
  const itemMonths = [-1, 0, 1].map((n) => addMonths(current, n)).map((m) => ({ value: m, label: `${monthLabel(m)}${paidMonths.has(m) ? " (already paid)" : ""}`, disabled: paidMonths.has(m) }));

  const views: { key: View; label: string; icon: typeof Wallet; count?: number }[] = [
    { key: "month", label: "Monthly pay", icon: CalendarRange },
    { key: "structure", label: "Salary structure", icon: SlidersHorizontal },
    { key: "history", label: "Payslip history", icon: History, count: payments.length },
  ];

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard icon={Wallet} tone="indigo" label="Net a month" value={salary ? rupees(salary.net) : "Not set"} detail={salary ? `Gross ${rupees(salary.gross)}` : "Set basic pay"} href={`${base}&sv=structure`} />
        <StatCard
          icon={CalendarRange}
          tone={thisMonth ? (thisMonth.published ? "emerald" : "sky") : "amber"}
          label={monthLabel(current)}
          value={thisMonth ? rupees(thisMonth.amount) : salary ? "Not paid" : "—"}
          detail={thisMonth ? (thisMonth.published ? "Paid · slip published" : "Paid · draft slip") : "This month's salary"}
          href={`${base}&month=${current}`}
        />
        <StatCard icon={ReceiptText} tone="emerald" label={`Paid in ${current.slice(0, 4)}`} value={rupees(sessionPaid)} detail={`${payments.filter((p) => p.month.startsWith(current.slice(0, 4))).length} slips`} href={`${base}&sv=history`} />
        <StatCard
          icon={History}
          tone="slate"
          label="Last paid"
          value={last ? day.format(last.paidOn) : "Never"}
          detail={last ? `${monthLabel(last.month)} · ${MODE_LABELS[last.mode]}` : "No salary paid yet"}
          href={last ? `/admin/payslips/${last.id}` : undefined}
        />
      </StatGrid>

      <nav aria-label="Salary views" className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-3 p-1">
        {views.map((v) => {
          const on = v.key === view;
          return (
            <Link
              key={v.key}
              href={v.key === "month" ? base : `${base}&sv=${v.key}`}
              replace
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={cx("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition", on ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}
            >
              <v.icon className="h-4 w-4" />
              {v.label}
              {v.count ? <span className="rounded-full bg-surface-3 px-1.5 text-xs tabular-nums text-muted">{v.count}</span> : null}
            </Link>
          );
        })}
      </nav>

      {view === "month" && <MonthView schoolId={schoolId} person={person} personKey={key} name={name} month={month} current={current} today={today} base={base} itemMonths={itemMonths} />}

      {view === "structure" && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Card
            title="Salary structure"
            icon={SlidersHorizontal}
            description="Basic pay plus the school's earnings and deductions. Give a component their own value, or leave it blank for the school's default. Applies to months not yet paid."
            action={<PersonalComponentButton person={person} name={name} />}
          >
            <SalaryStructureForm action={saveSalaryStructure.bind(null, person)} basic={basic} components={components} own={own.get(key) ?? {}} />
          </Card>
          <div className="space-y-6">
            <Card title="Monthly salary" icon={ReceiptText} description="As paid each month, before unpaid days and one-time items.">
              {salary ? <SalaryBreakdown salary={salary} /> : <p className="text-sm text-muted">Enter basic pay and save to see the salary.</p>}
            </Card>
            <Card title="Good to know" icon={CircleAlert}>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted">
                <li>
                  <strong className="font-medium text-fg-2">Add component for {first}</strong> adds a regular earning or deduction only they get, every month.
                </li>
                <li>
                  For one month only (a bonus, an advance recovered), use a <strong className="font-medium text-fg-2">one-time item</strong> on{" "}
                  <Link href={base} className="text-accent-text hover:underline">
                    Monthly pay
                  </Link>
                  .
                </li>
                <li>
                  School-wide components and their defaults are in{" "}
                  <Link href="/admin/settings/payroll" className="text-accent-text hover:underline">
                    Settings → Payroll
                  </Link>
                  .
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {view === "history" && (
        <Card title="Payslip history" icon={History} description={`Every salary paid to ${first}, newest first.`} padded={false}>
          <PayslipHistory
            rows={payments.map((p) => ({
              id: p.id,
              month: p.month,
              gross: p.gross ?? p.amount,
              amount: p.amount,
              lopDays: p.lopDays,
              paidOn: isoDate(p.paidOn),
              mode: p.mode,
              published: p.published,
            }))}
          />
        </Card>
      )}
    </div>
  );
}

const STATUS: Record<"unpaid" | "draft" | "published", { label: string; tone: BadgeTone }> = {
  unpaid: { label: "Not paid yet", tone: "amber" },
  draft: { label: "Paid · draft slip", tone: "sky" },
  published: { label: "Paid · published", tone: "green" },
};

/** One month: the slip (saved, or worked out now), what to do next, and the month's one-time items. */
async function MonthView({
  schoolId,
  person,
  personKey,
  name,
  month,
  current,
  today,
  base,
  itemMonths,
}: {
  schoolId: string;
  person: { teacherId: string } | { staffId: string };
  personKey: string;
  name: string;
  month: string;
  current: string;
  today: string;
  base: string;
  itemMonths: { value: string; label: string; disabled?: boolean }[];
}) {
  const [payment, items] = await Promise.all([
    db.salaryPayment.findFirst({ where: { schoolId, month, ...person } }),
    db.salaryAdjustment.findMany({ where: { schoolId, month, ...person }, orderBy: { createdAt: "asc" } }),
  ]);
  const preview = payment ? null : await previewPayslip(schoolId, personKey, month);
  const first = name.split(" ")[0];
  const label = monthLabel(month);
  const status = payment ? (payment.published ? "published" : "draft") : "unpaid";
  const lines = payment ? ((Array.isArray(payment.lines) ? payment.lines : [{ name: "Salary", kind: "EARNING", amount: payment.amount }]) as SlipLine[]) : (preview?.lines ?? []);
  const lopAmount = preview?.preview?.lopAmount ?? 0;
  const lopDays = preview?.lopDays ?? 0;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="overflow-clip rounded-2xl border border-line bg-surface shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <MonthPicker basePath={base} month={month} max={addMonths(current, 1)} current={current} />
          {(payment || preview) && (
            <Badge tone={STATUS[status].tone} dot>
              {STATUS[status].label}
            </Badge>
          )}
        </header>

        {!payment && !preview ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No salary set"
            description={`Set ${first}'s basic pay to work out and pay their salary.`}
            action={
              <ButtonLink href={`${base}&sv=structure`} size="sm" icon={SlidersHorizontal}>
                Set salary
              </ButtonLink>
            }
          />
        ) : (
          <div className="space-y-5 p-4 sm:p-6">
            <p className="text-sm text-muted">
              {payment
                ? `Paid ${day.format(payment.paidOn)} by ${MODE_LABELS[payment.mode]}.${payment.published ? ` ${first} can see this slip.` : ` The slip is a draft: ${first} can't see it until it's published.`}`
                : month > current
                  ? `${label} hasn't started. This is the salary as it stands, before any attendance.`
                  : `Worked out ${month === current ? "so far" : "now"} from the salary structure${lopDays ? `, with ${dayCount(lopDays)} unpaid deducted` : ""}. The real slip is made when ${first} is paid.`}
            </p>
            <SalaryBreakdown salary={totals(lines)} netLabel={payment ? `Net paid · ${label}` : `Net pay · ${label}${month === current ? " so far" : ""}`} />
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {status === "unpaid" && preview && (
                <>
                  <PayPersonButton personKey={personKey} name={name} month={month} monthName={label} net={preview.amount + lopAmount} lopDays={lopDays} lopAmount={lopAmount} today={today} />
                  <ButtonLink href={`/admin/payroll/preview?person=${encodeURIComponent(personKey)}&month=${month}`} variant="secondary" icon={Eye}>
                    Preview slip
                  </ButtonLink>
                </>
              )}
              {status === "draft" && payment && (
                <>
                  <ActionForm action={publishPayslip.bind(null, payment.id)} compact className="flex flex-row-reverse items-center gap-2">
                    <SubmitButton icon={<Send className="h-4 w-4" />} confirm={`Publish ${first}'s ${label} slip?`} confirmMessage="They will be able to see, print and download it.">
                      Publish slip
                    </SubmitButton>
                  </ActionForm>
                  <ButtonLink href={`/admin/payslips/${payment.id}/edit`} variant="secondary" icon={FilePen}>
                    Edit slip
                  </ButtonLink>
                  <ButtonLink href={`/admin/payslips/${payment.id}`} variant="ghost" icon={FileText}>
                    View slip
                  </ButtonLink>
                </>
              )}
              {status === "published" && payment && (
                <>
                  <ButtonLink href={`/admin/payslips/${payment.id}`} icon={FileText}>
                    View slip
                  </ButtonLink>
                  <ActionForm action={unpublishPayslip.bind(null, payment.id)} compact className="flex flex-row-reverse items-center gap-2">
                    <SubmitButton
                      variant="ghost"
                      icon={<EyeOff className="h-4 w-4" />}
                      confirm={`Unpublish ${first}'s ${label} slip?`}
                      confirmMessage="It goes back to draft, hidden from them, and can be edited."
                    >
                      Unpublish
                    </SubmitButton>
                  </ActionForm>
                </>
              )}
              <Link href={`/admin/payroll?month=${month}`} className="ml-auto text-sm font-medium text-accent-text hover:underline">
                {label} payroll →
              </Link>
            </div>
          </div>
        )}
      </section>

      <Card
        title={`One-time items · ${label}`}
        icon={CalendarPlus}
        description={payment ? "Already on the paid slip." : "Added to the slip when they're paid."}
        action={itemMonths.some((m) => !m.disabled) ? <AddOneTimeItemButton personKey={personKey} name={name} months={itemMonths.map((m) => ({ ...m, selected: m.value === month }))} /> : undefined}
        padded={false}
      >
        <OneTimeItems
          compact
          items={items.map((it) => ({ id: it.id, name: it.name, kind: it.kind, amount: it.amount, note: it.note, person: name, profileHref: null, onSlip: !!payment }))}
        />
      </Card>
    </div>
  );
}
