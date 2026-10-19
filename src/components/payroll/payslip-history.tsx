"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ReceiptText } from "lucide-react";
import { Badge, EmptyState, SegmentedControl, selectClass } from "@/components/ui";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { dayCount } from "@/lib/payroll-shared";

export type HistoryRow = {
  id: string;
  month: string; // "2026-09"
  gross: number;
  amount: number;
  lopDays: number | null;
  paidOn: string;
  mode: string;
  published: boolean;
};

const PAGE = 12;
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** One person's salary slips, newest first, filtered by year and status, with totals for what's shown. */
export function PayslipHistory({ rows }: { rows: HistoryRow[] }) {
  const years = useMemo(() => [...new Set(rows.map((r) => r.month.slice(0, 4)))].sort().reverse(), [rows]);
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [page, setPage] = useState(1);

  const shown = rows.filter((r) => (year === "all" || r.month.startsWith(year)) && (status === "all" || (status === "published") === r.published));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const visible = shown.slice((current - 1) * PAGE, current * PAGE);
  const paid = shown.reduce((n, r) => n + r.amount, 0);

  if (!rows.length) return <EmptyState icon={ReceiptText} title="No salary slips yet" description="A slip is made each time a salary is paid from Payroll." />;

  const th = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted first:pl-6 last:pr-6";
  const td = "px-4 py-3 first:pl-6 last:pr-6";
  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setPage(1);
          }}
          aria-label="Year"
          className={`${selectClass} !w-36 !py-2`}
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <SegmentedControl
          label="Status"
          size="sm"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Drafts" },
          ]}
        />
        <p className="text-sm text-muted sm:ml-auto">
          {shown.length} slip{shown.length === 1 ? "" : "s"} · <span className="font-semibold tabular-nums text-fg">{rupees(paid)}</span> paid
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted">No slips match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-surface-2/70">
              <tr>
                <th className={th}>Month</th>
                <th className={`${th} text-right`}>Gross</th>
                <th className={`${th} text-right`}>Deductions</th>
                <th className={`${th} text-right`}>Net paid</th>
                <th className={th}>Paid on</th>
                <th className={th}>Status</th>
                <th className={th}>
                  <span className="sr-only">Slip</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => (
                <tr key={r.id} className="transition hover:bg-surface-2/60">
                  <td className={td}>
                    <Link href={`/admin/payslips/${r.id}`} className="font-medium text-fg hover:text-accent-text">
                      {monthFmt.format(new Date(`${r.month}-01T00:00:00Z`))}
                    </Link>
                    {r.lopDays ? <span className="block text-xs text-danger">{dayCount(r.lopDays)} unpaid</span> : null}
                  </td>
                  <td className={`${td} text-right tabular-nums text-fg-2`}>{rupees(r.gross)}</td>
                  <td className={`${td} text-right tabular-nums text-danger`}>{r.gross > r.amount ? `−${rupees(r.gross - r.amount)}` : "—"}</td>
                  <td className={`${td} text-right font-semibold tabular-nums text-fg`}>{rupees(r.amount)}</td>
                  <td className={`${td} whitespace-nowrap text-muted`}>
                    {dayFmt.format(new Date(`${r.paidOn}T00:00:00Z`))}
                    <span className="block text-xs">{MODE_LABELS[r.mode as keyof typeof MODE_LABELS] ?? r.mode}</span>
                  </td>
                  <td className={td}>
                    {r.published ? (
                      <Badge tone="green" dot>
                        Published
                      </Badge>
                    ) : (
                      <Badge tone="sky" dot>
                        Draft
                      </Badge>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <Link href={`/admin/payslips/${r.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent-text hover:bg-accent-soft">
                      <FileText className="h-3.5 w-3.5" /> Slip
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
          <span className="tabular-nums">
            {(current - 1) * PAGE + 1}–{Math.min(current * PAGE, shown.length)} of {shown.length} slips
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className={pagerBtn}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-14 text-center tabular-nums">
              {current} / {pages}
            </span>
            <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Next page" className={pagerBtn}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

const pagerBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40";
