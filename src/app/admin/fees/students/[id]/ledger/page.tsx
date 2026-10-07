import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgePercent, Ban, Clock, Download, ExternalLink, HandCoins, ListTree, ReceiptText, ShieldOff, Undo2 } from "lucide-react";
import { AutoPrint } from "@/components/fees/auto-print";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, EmptyState, buttonVariants, cx } from "@/components/ui";
import { getFeesAccess, loadLedger, type LedgerEntry } from "@/lib/fees";
import { rupees } from "@/lib/fees-shared";
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

      {/* Month by month */}
      <Card title="Month by month" padded={false} className="print:border-0 print:shadow-none">
        {months.length === 0 ? (
          <EmptyState icon={ListTree} title="No fees charged this session" description={student.section ? "No fee amounts are set for this class yet." : "This student has no class, so no class fees apply."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm print:text-[8pt]">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className={th}>Month</th>
                  <th className={`${th} text-right`}>Fees</th>
                  <th className={`${th} text-right`}>Late fee</th>
                  <th className={`${th} text-right`}>Discount</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={`${th} text-right`}>Balance</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {months.map((m) => {
                  const s = STATUS[m.status];
                  return (
                    <tr key={m.key} className={m.status === "UPCOMING" ? "text-muted" : "text-fg-2"}>
                      <td className={td}>
                        <Link href={`/admin/fee-desk/${student.id}/${m.key}`} className="font-medium text-fg hover:text-accent-text hover:underline print:no-underline">
                          {m.label}
                        </Link>
                        <p className="text-xs text-muted">{m.fees.join(", ")}</p>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{rupees(m.charged)}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        {m.late || m.lateDue ? (
                          <span className="text-danger">
                            {rupees(m.late + m.lateDue)}
                            {m.lateDue > 0 && <span className="block text-[11px]">{m.late ? `${rupees(m.lateDue)} due` : "due"}</span>}
                          </span>
                        ) : (
                          money(0)
                        )}
                      </td>
                      <td className={`${td} text-right tabular-nums text-accent-text`}>{money(m.discount)}</td>
                      <td className={`${td} text-right tabular-nums`}>{money(m.paid + m.late)}</td>
                      <td className={`${td} text-right font-semibold tabular-nums ${m.balance && m.status !== "UPCOMING" ? "text-danger" : ""}`}>{money(m.balance)}</td>
                      <td className={td}>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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

function Figure({ label, value, tone = "text-fg", note, strong }: { label: string; value: number; tone?: string; note?: string; strong?: boolean }) {
  return (
    <div className={cx("border-b border-line px-5 py-4 lg:border-b-0", strong && "bg-surface-2/60")}>
      <dt className="text-eyebrow uppercase text-muted">{label}</dt>
      <dd className={`mt-1 tabular-nums ${strong ? "text-xl" : "text-lg"} font-semibold ${tone}`}>{rupees(value)}</dd>
      {note && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  );
}
