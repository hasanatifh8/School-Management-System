import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgePercent, Ban, Clock, Download, ExternalLink, HandCoins, ListTree, ReceiptText, ShieldOff, Undo2 } from "lucide-react";
import { AutoPrint } from "@/components/fees/auto-print";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, EmptyState, buttonVariants, cx } from "@/components/ui";
import { getFeesAccess, loadLedger, type LedgerEntry } from "@/lib/fees";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

const STATUS = {
  PAID: { tone: "green", label: "Paid" },
  PARTIAL: { tone: "amber", label: "Part paid" },
  OVERDUE: { tone: "red", label: "Overdue" },
  DUE: { tone: "amber", label: "Due" },
  UPCOMING: { tone: "slate", label: "Upcoming" },
  NONE: { tone: "slate", label: "—" },
} as const;

/** How each kind of statement line looks: an icon and tag, so discounts, late fees and waivers stand out. */
const KIND: Record<LedgerEntry["kind"], { icon: typeof ReceiptText; tag?: { label: string; tone: "green" | "red" | "amber" | "slate" | "indigo" } }> = {
  OPENING: { icon: Undo2, tag: { label: "Brought forward", tone: "slate" } },
  FEE: { icon: ReceiptText },
  LATE: { icon: Clock, tag: { label: "Late fee", tone: "red" } },
  LATE_DUE: { icon: Clock, tag: { label: "Late fee due", tone: "red" } },
  PAYMENT: { icon: HandCoins, tag: { label: "Payment", tone: "green" } },
  DISCOUNT: { icon: BadgePercent, tag: { label: "Discount", tone: "indigo" } },
  WAIVER: { icon: ShieldOff, tag: { label: "Waived", tone: "amber" } },
  CANCELLED: { icon: Ban, tag: { label: "Cancelled", tone: "slate" } },
};

const th = "whitespace-nowrap px-3 py-2.5 text-left text-eyebrow uppercase text-muted print:px-1.5 print:py-1";
const td = "px-3 py-2.5 align-top print:px-1.5 print:py-1";
const money = (n: number) => (n ? rupees(n) : <span className="text-subtle">—</span>);

/** A student's fee ledger for the session: summary, month by month, and a dated statement with a running balance. */
export default async function FeeLedgerPage({ params, searchParams }: PageProps<"/admin/fees/students/[id]/ledger">) {
  const { id } = await params;
  const sp = await searchParams;
  const { school } = await getFeesAccess();
  const ledger = await loadLedger(school.id, id);
  if (!ledger) notFound();
  const { student, session, statement, months, sums, today } = ledger;
  // The month opened from its card (?month=2026-10).
  const selected = typeof sp.month === "string" ? months.find((m) => m.key === sp.month) : undefined;
  const name = fullName(student);
  const pdf = `/api/fees/students/${student.id}/ledger`;

  return (
    <div className="space-y-6">
      {sp.print === "1" && <AutoPrint />}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/admin/fees/students/${student.id}`} className={buttonVariants.ghost}>
          <ArrowLeft className="h-4 w-4" />
          {student.firstName}&apos;s fees
        </BackLink>
        <div className="flex flex-wrap gap-2">
          <a href={`${pdf}?inline=1`} target="_blank" rel="noopener" className={buttonVariants.secondary}>
            <ExternalLink className="h-4 w-4" />
            View PDF
          </a>
          <a href={pdf} download className={buttonVariants.secondary}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <PrintButton label="Print" />
        </div>
      </div>

      <style>{`@page { size: A4 portrait; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>

      {/* Who and the bottom line */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="text-eyebrow uppercase text-muted">Fee ledger · Session {session.name}</p>
            <h1 className="mt-1 text-h2 font-semibold text-fg">{name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="font-mono">{student.studentCode}</span>
              {student.section && <span>{sectionLabel(student.section)}</span>}
              {student.rollNumber != null && <span>Roll {student.rollNumber}</span>}
              {student.fatherName && <span>Father: {student.fatherName}</span>}
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <p className="font-medium text-fg-2">{school.name}</p>
            <p>As of {fmt(today)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          <Figure label="Fees charged" value={sums.fees + sums.opening} note={sums.opening ? `incl. ${rupees(sums.opening)} brought forward` : undefined} />
          <Figure label="Late fees" value={sums.lateCharged + sums.lateDue} tone={sums.lateCharged + sums.lateDue ? "text-danger" : undefined} note={sums.lateDue ? `${rupees(sums.lateDue)} still due` : undefined} />
          <Figure label="Discounts" value={sums.discount} tone={sums.discount ? "text-accent-text" : undefined} />
          <Figure label="Late fee waived" value={sums.lateWaived} tone={sums.lateWaived ? "text-warning" : undefined} />
          <Figure label="Paid" value={sums.paid} tone="text-success" />
          <Figure label="Balance due" value={sums.dueNow} tone={sums.dueNow ? "text-danger" : "text-success"} note={sums.upcoming ? `${rupees(sums.upcoming)} upcoming` : undefined} strong />
        </dl>
      </section>

      {/* Month by month: a card each; open one for its fees and collections */}
      <section className="space-y-3 print:break-inside-avoid">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-fg">Month by month</h2>
          <p className="text-xs text-muted print:hidden">Open a month to see its fees and every collection made for it.</p>
        </div>
        {months.length === 0 ? (
          <Card>
            <EmptyState icon={ListTree} title="No fees charged this session" description={student.section ? "No fee amounts are set for this class yet." : "This student has no class, so no class fees apply."} />
          </Card>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-4">
            {months.map((m) => {
              const s = STATUS[m.status];
              const on = m.key === selected?.key;
              return (
                <li key={m.key}>
                  <Link
                    href={on ? `?` : `?month=${m.key}#month`}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={cx(
                      "flex h-full flex-col rounded-2xl border bg-surface p-3.5 shadow-card transition hover:-translate-y-px hover:shadow-lift print:shadow-none",
                      on ? "border-accent ring-4 ring-accent/15" : MONTH_BORDER[m.status],
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-fg">{m.key === "arrears" ? m.label : m.label.split(" ")[0]}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </span>
                    <span className="mt-2 text-lg font-semibold tabular-nums text-fg">{rupees(m.charged)}</span>
                    <span className="text-xs text-muted">
                      {m.paid + m.late > 0 ? `Paid ${rupees(m.paid + m.late)}` : "Nothing paid"}
                      {m.balance > 0 && <span className={m.status === "UPCOMING" ? "" : "text-danger"}> · {rupees(m.balance)} left</span>}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      {m.late + m.lateDue > 0 && <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger">Late {rupees(m.late + m.lateDue)}</span>}
                      {m.discount > 0 && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent-text">Discount {rupees(m.discount)}</span>}
                      {m.payments.length > 0 && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">
                          {m.payments.length} receipt{m.payments.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {selected && (
          <Card
            id="month"
            title={selected.label}
            description={selected.fees.join(", ")}
            padded={false}
            action={
              <span className="flex items-center gap-2 print:hidden">
                <Badge tone={STATUS[selected.status].tone}>{STATUS[selected.status].label}</Badge>
                {selected.balance > 0 && (
                  <Link href={`/admin/fee-desk/${student.id}/${selected.key}`} className={buttonVariants.secondary}>
                    Open bill
                  </Link>
                )}
              </span>
            }
          >
            <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-line">
              <div className="overflow-x-auto">
                <p className="border-b border-line px-4 py-2 text-eyebrow uppercase text-muted sm:px-6">Fees</p>
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {selected.items.map((d) => (
                      <tr key={`${d.name}|${d.label}`}>
                        <td className={td}>
                          <p className="font-medium text-fg">{d.name}</p>
                          <p className="text-xs text-muted">Due {fmt(d.due)}</p>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          <p className="text-fg">{rupees(d.amount)}</p>
                          {d.discount > 0 && <p className="text-xs text-accent-text">− {rupees(d.discount)} discount</p>}
                          {d.lateFeePaid + d.lateFee > 0 && <p className="text-xs text-danger">+ {rupees(d.lateFeePaid + d.lateFee)} late{d.lateFee > 0 ? " (due)" : ""}</p>}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          {d.balance > 0 ? <span className="font-medium text-danger">{rupees(d.balance)} left</span> : <span className="font-medium text-success">Paid</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="border-b border-line px-4 py-2 text-eyebrow uppercase text-muted sm:px-6">Collections for this month</p>
                {selected.payments.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted sm:px-6">Nothing collected for {selected.label} yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {selected.payments.map((p) => (
                      <li key={p.id} className="px-4 py-3 text-sm sm:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Link href={`/admin/fees/receipts/${p.id}?from=ledger`} className="font-mono text-xs font-medium text-accent-text hover:underline">
                              {p.number}
                            </Link>
                            <span className="text-muted">
                              {fmt(p.date)} · {MODE_LABELS[p.mode]}
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums text-success">{rupees(p.fees + p.late)}</span>
                        </div>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          <span>Fees {rupees(p.fees)}</span>
                          {p.late > 0 && <span className="text-danger">Late fee {rupees(p.late)}</span>}
                          {p.discount > 0 && (
                            <span className="text-accent-text">
                              Discount {rupees(p.discount)}
                              {p.note && ` · ${p.note}`}
                            </span>
                          )}
                          {p.lateWaived > 0 && <span className="text-warning">Late fee waived {rupees(p.lateWaived)} on this receipt</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-line bg-surface-2/60 px-4 py-3 text-sm sm:grid-cols-5 sm:px-6">
              <MonthFigure label="Fees" value={selected.charged} />
              <MonthFigure label="Late fee" value={selected.late + selected.lateDue} tone="text-danger" />
              <MonthFigure label="Discount" value={selected.discount} tone="text-accent-text" />
              <MonthFigure label="Paid" value={selected.paid + selected.late} tone="text-success" />
              <MonthFigure label="Left" value={selected.balance + selected.lateDue} tone={selected.balance ? "text-danger" : "text-success"} />
            </dl>
          </Card>
        )}
      </section>

      {/* The statement */}
      <Card title="Statement" description="Every charge, payment, discount and waiver in date order, with the balance after each." padded={false} className="print:break-before-page print:border-0 print:shadow-none">
        {statement.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Nothing yet" description="Fees appear here as they fall due, and payments as they are made." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm print:text-[8pt]">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Particulars</th>
                  <th className={th}>Receipt</th>
                  <th className={`${th} text-right`}>Charged</th>
                  <th className={`${th} text-right`}>Paid / off</th>
                  <th className={`${th} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {statement.map((e, i) => {
                  const k = KIND[e.kind];
                  const info = e.kind === "WAIVER" || e.kind === "CANCELLED";
                  return (
                    <tr key={i} className={cx(e.kind === "CANCELLED" && "text-subtle line-through", e.kind === "WAIVER" && "bg-warning-soft/30", e.kind === "DISCOUNT" && "bg-accent-soft/30")}>
                      <td className={`${td} whitespace-nowrap text-muted`}>{fmt(e.date)}</td>
                      <td className={td}>
                        <span className="flex items-start gap-2">
                          <k.icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle print:hidden" aria-hidden />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium text-fg">{e.particulars}</span>
                              {k.tag && e.kind !== "PAYMENT" && <Badge tone={k.tag.tone}>{k.tag.label}</Badge>}
                            </span>
                            {e.detail && <span className="block text-xs text-muted">{e.detail}</span>}
                          </span>
                        </span>
                      </td>
                      <td className={td}>
                        {e.receipt ? (
                          <Link href={`/admin/fees/receipts/${e.receipt.id}?from=ledger`} className="font-mono text-xs font-medium text-accent-text hover:underline">
                            {e.receipt.number}
                          </Link>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className={`${td} text-right tabular-nums ${e.kind === "LATE" || e.kind === "LATE_DUE" ? "text-danger" : ""}`}>{info ? "" : money(e.debit)}</td>
                      <td className={`${td} text-right tabular-nums ${e.kind === "DISCOUNT" ? "text-accent-text" : "text-success"}`}>{info ? "" : money(e.credit)}</td>
                      <td className={`${td} text-right font-medium tabular-nums ${e.balance > 0 ? "text-fg" : "text-success"}`}>{info ? "" : rupees(e.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-line-strong font-semibold text-fg">
                <tr>
                  <td className={td} colSpan={3}>
                    Balance due as of {fmt(today)}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{rupees(statement.reduce((n, e) => n + e.debit, 0))}</td>
                  <td className={`${td} text-right tabular-nums`}>{rupees(statement.reduce((n, e) => n + e.credit, 0))}</td>
                  <td className={`${td} text-right tabular-nums ${sums.dueNow ? "text-danger" : "text-success"}`}>{rupees(sums.dueNow)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const MONTH_BORDER: Record<keyof typeof STATUS, string> = {
  PAID: "border-success-line",
  PARTIAL: "border-warning-line",
  OVERDUE: "border-danger-line",
  DUE: "border-warning-line",
  UPCOMING: "border-line",
  NONE: "border-line",
};

function MonthFigure({ label, value, tone = "text-fg" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`font-semibold tabular-nums ${value ? tone : "text-subtle"}`}>{rupees(value)}</dd>
    </div>
  );
}

function Figure({ label, value, tone = "text-fg", note, strong }: { label: string; value: number; tone?: string; note?: string; strong?: boolean }) {
  return (
    <div className={cx("border-b border-line px-5 py-4 lg:border-b-0", strong && "bg-surface-2/60")}>
      <dt className="text-eyebrow uppercase text-muted">{label}</dt>
      <dd className={`mt-1 tabular-nums ${strong ? "text-xl" : "text-lg"} font-semibold ${tone}`}>{rupees(value)}</dd>
      {note && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  );
}
