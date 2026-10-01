import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, ListTree, Receipt } from "lucide-react";
import { AutoPrint } from "@/components/fees/auto-print";
import { PrintButton } from "@/components/print-button";
import { Badge, ButtonLink, Card, EmptyState, buttonVariants } from "@/components/ui";
import { getFeesAccess, loadLedger } from "@/lib/fees";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

const STATUS = {
  PAID: { tone: "green", label: "Paid" },
  PARTIAL: { tone: "amber", label: "Part paid" },
  OVERDUE: { tone: "red", label: "Overdue" },
  UPCOMING: { tone: "slate", label: "Upcoming" },
} as const;

const th = "whitespace-nowrap px-3 py-2.5 text-left text-eyebrow uppercase text-muted print:px-1.5 print:py-1";
const td = "px-3 py-2.5 align-top print:px-1.5 print:py-1";

/** A student's fee ledger for the session, with the payment history; printable and as a PDF. */
export default async function FeeLedgerPage({ params, searchParams }: PageProps<"/admin/fees/students/[id]/ledger">) {
  const { id } = await params;
  const sp = await searchParams;
  const { school } = await getFeesAccess();
  const ledger = await loadLedger(school.id, id);
  if (!ledger) notFound();
  const { student, session, rows, history, totals, today } = ledger;
  const name = fullName(student);
  const pdf = `/api/fees/students/${student.id}/ledger`;

  return (
    <div className="space-y-6">
      {sp.print === "1" && <AutoPrint />}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <ButtonLink href={`/admin/fees/students/${student.id}`} variant="secondary" icon={ArrowLeft}>
          Back to {student.firstName}&apos;s fees
        </ButtonLink>
        <div className="flex flex-wrap gap-2">
          <a href={`${pdf}?inline=1`} target="_blank" rel="noopener" className={buttonVariants.secondary}>
            <ExternalLink className="h-4 w-4" />
            View PDF
          </a>
          <a href={pdf} download className={buttonVariants.secondary}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <PrintButton label="Print ledger" />
        </div>
      </div>

      <style>{`@page { size: A4 portrait; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6 print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-eyebrow uppercase text-muted">Fee ledger · Session {session.name}</p>
            <h2 className="mt-1 text-h2 font-semibold text-fg">{name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-mono">{student.studentCode}</span>
              {student.section && <Badge tone="indigo">{sectionLabel(student.section)}</Badge>}
              {student.rollNumber != null && <Badge>Roll {student.rollNumber}</Badge>}
              {student.fatherName && <span>Father: {student.fatherName}</span>}
            </p>
          </div>
          <p className="text-xs text-muted">
            {school.name} · As of {fmt(today)}
          </p>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile label="Total fee" value={rupees(totals.total)} />
          <Tile label="Discount" value={rupees(totals.discount)} tone={totals.discount ? "text-success" : undefined} />
          <Tile label="Paid" value={rupees(totals.paid)} tone="text-success" />
          <Tile label="Due now" value={rupees(totals.dueNow)} tone={totals.dueNow ? "text-danger" : undefined} />
          <Tile label="Upcoming" value={rupees(totals.upcoming)} />
        </dl>
      </section>

      <Card title="Instalments" description="Every fee charged this session, what was paid or discounted, and what is still due." padded={false} className="print:border-0 print:shadow-none">
        {rows.length === 0 ? (
          <EmptyState icon={ListTree} title="No fees charged this session" description={student.section ? "No fee amounts are set for this class yet." : "This student has no class, so no class fees apply."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm print:text-[8pt]">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className={th}>Fee / period</th>
                  <th className={`${th} text-right`}>Total fee</th>
                  <th className={`${th} text-right`}>Discount</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={`${th} text-right`}>Due</th>
                  <th className={th}>Paid on</th>
                  <th className={th}>Receipt</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={`${r.headId}|${r.period}`} className={r.status === "UPCOMING" ? "text-subtle" : "text-fg-2"}>
                    <td className={td}>
                      <p className="font-medium text-fg">{r.headName}</p>
                      <p className="text-xs text-muted">
                        {r.label} · due {fmt(r.due)}
                      </p>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{rupees(r.amount)}</td>
                    <td className={`${td} text-right tabular-nums ${r.discount ? "text-success" : ""}`}>{r.discount ? rupees(r.discount) : "—"}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.paid ? rupees(r.paid) : "—"}</td>
                    <td className={`${td} text-right font-medium tabular-nums ${r.balance && r.status !== "UPCOMING" ? "text-danger" : ""}`}>{r.balance ? rupees(r.balance) : "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{r.payments.length ? r.payments.map((p) => <p key={p.id}>{fmt(p.date)}</p>) : "—"}</td>
                    <td className={td}>
                      {r.payments.length
                        ? r.payments.map((p) => (
                            <p key={p.id}>
                              <Link href={`/admin/fees/receipts/${p.id}`} className="font-mono text-xs font-medium text-accent-text hover:underline">
                                {p.number}
                              </Link>
                            </p>
                          ))
                        : "—"}
                    </td>
                    <td className={td}>
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line-strong font-semibold text-fg">
                <tr>
                  <td className={td}>Total</td>
                  <td className={`${td} text-right tabular-nums`}>{rupees(totals.total)}</td>
                  <td className={`${td} text-right tabular-nums`}>{rupees(totals.discount)}</td>
                  <td className={`${td} text-right tabular-nums`}>{rupees(totals.paid)}</td>
                  <td className={`${td} text-right tabular-nums`}>{rupees(totals.dueNow + totals.upcoming)}</td>
                  <td className={td} colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Payment history" description="Every receipt for this student, in all sessions." padded={false} className="print:break-inside-avoid print:border-0 print:shadow-none">
        {history.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm print:text-[8pt]">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Receipt</th>
                  <th className={th}>Session</th>
                  <th className={th}>Mode</th>
                  <th className={`${th} text-right`}>Discount</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((h) => (
                  <tr key={h.id} className={h.cancelled ? "text-subtle" : "text-fg-2"}>
                    <td className={`${td} whitespace-nowrap`}>{fmt(h.date)}</td>
                    <td className={td}>
                      <Link href={`/admin/fees/receipts/${h.id}`} className="font-mono text-xs font-medium text-accent-text hover:underline">
                        {h.number}
                      </Link>
                    </td>
                    <td className={td}>{h.session}</td>
                    <td className={td}>{MODE_LABELS[h.mode]}</td>
                    <td className={`${td} text-right tabular-nums`}>{h.discount ? rupees(h.discount) : "—"}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{rupees(h.paid)}</td>
                    <td className={td}>{h.cancelled ? <Badge tone="red">Cancelled</Badge> : <Badge tone="green">Valid</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, tone = "text-fg" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <dt className="text-eyebrow uppercase text-muted">{label}</dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
