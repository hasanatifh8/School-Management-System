import Link from "next/link";
import { Plane } from "lucide-react";
import { Card } from "@/components/ui";
import type { LeaveBalance } from "@/lib/leave";
import { CATEGORY_LABELS } from "@/lib/leave-shared";

/**
 * A teacher's or staff member's leave left this session, one bar per type
 * (PL first). Types without a limit show only the days used, and only once used.
 */
export function LeaveBalanceCard({ balance, className, applyHref }: { balance: LeaveBalance; className?: string; applyHref?: string }) {
  const rows = balance.rows.filter((r) => r.allowed != null || r.used || r.pending);
  return (
    <Card
      title="Leave balance"
      icon={Plane}
      description={`Session ${balance.session}${balance.policy ? ` · ${balance.policy.name}` : ""}`}
      padded={false}
      className={className}
      action={
        applyHref && (
          <Link href={applyHref} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
            Apply
          </Link>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">The school hasn&apos;t set leave days yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const left = r.allowed == null ? null : Math.max(0, r.allowed - r.used);
            const pct = r.allowed ? Math.min(100, Math.round((r.used / r.allowed) * 100)) : r.allowed === 0 ? 100 : 0;
            return (
              <li key={r.category} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-fg">{CATEGORY_LABELS[r.category]}</span>
                  <span className="whitespace-nowrap tabular-nums text-muted">
                    {r.allowed == null ? (
                      `${r.used} used`
                    ) : (
                      <>
                        <span className={left ? "font-semibold text-fg" : "font-semibold text-danger"}>{left}</span> of {r.allowed} left
                      </>
                    )}
                  </span>
                </div>
                {r.allowed != null && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={`h-full rounded-full ${pct >= 100 ? "bg-danger-solid" : pct >= 75 ? "bg-warning-solid" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {r.extra !== 0 && (
                  <p className="mt-1 text-xs text-muted">
                    Includes {r.extra > 0 ? `${r.extra} extra` : `${-r.extra} fewer`} day{Math.abs(r.extra) === 1 ? "" : "s"} for this session
                  </p>
                )}
                {r.pending > 0 && <p className="mt-1 text-xs text-warning">{r.pending} day{r.pending === 1 ? "" : "s"} waiting for approval</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
