import { rupees } from "@/lib/fees-shared";
import { rupeesInWords, type SlipLine } from "@/lib/payroll-shared";

/**
 * A month's salary laid out like a slip: earnings beside deductions, their
 * totals, and the net pay in figures and words.
 */
export function SalaryBreakdown({ salary, netLabel = "Net pay a month" }: { salary: { lines: SlipLine[]; gross: number; deductions: number; net: number }; netLabel?: string }) {
  const earnings = salary.lines.filter((l) => l.kind === "EARNING");
  const deductions = salary.lines.filter((l) => l.kind === "DEDUCTION");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Column title="Earnings" lines={earnings} total={salary.gross} totalLabel="Gross earnings" empty="None" />
        <Column title="Deductions" lines={deductions} total={salary.deductions} totalLabel="Total deductions" empty="No deductions" deduction />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-success-line bg-success-soft px-4 py-3">
        <div className="min-w-0">
          <p className="text-eyebrow uppercase text-success">{netLabel}</p>
          <p className="text-xs italic text-fg-2">{rupeesInWords(salary.net)}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-success">{rupees(salary.net)}</p>
      </div>
    </div>
  );
}

function Column({
  title,
  lines,
  total,
  totalLabel,
  empty,
  deduction,
}: {
  title: string;
  lines: SlipLine[];
  total: number;
  totalLabel: string;
  empty: string;
  deduction?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <p className="border-b border-line bg-surface-2 px-4 py-2 text-eyebrow uppercase text-muted">{title}</p>
      <ul className="divide-y divide-line text-sm">
        {lines.length === 0 ? (
          <li className="px-4 py-2.5 text-muted">{empty}</li>
        ) : (
          lines.map((l) => (
            <li key={`${l.name}-${l.amount}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-fg-2">{l.name}</span>
              <span className={`tabular-nums ${deduction ? "text-danger" : "text-fg"}`}>{rupees(l.amount)}</span>
            </li>
          ))
        )}
      </ul>
      <p className="flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold">
        <span className="text-fg">{totalLabel}</span>
        <span className={`tabular-nums ${deduction ? "text-danger" : "text-fg"}`}>{rupees(total)}</span>
      </p>
    </div>
  );
}
