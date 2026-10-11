import Link from "next/link";
import { CircleCheck, CircleX, Hourglass, Layers, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/cx";
import type { LeaveStatusKey } from "@/lib/leave-shared";

const TONES = {
  amber: { card: "border-amber-500/25 bg-amber-500/[0.07]", icon: "bg-amber-500 text-white", ring: "ring-amber-500/60", text: "text-amber-700 dark:text-amber-300" },
  green: { card: "border-emerald-500/25 bg-emerald-500/[0.07]", icon: "bg-emerald-600 text-white", ring: "ring-emerald-500/60", text: "text-emerald-700 dark:text-emerald-300" },
  rose: { card: "border-rose-500/25 bg-rose-500/[0.07]", icon: "bg-rose-600 text-white", ring: "ring-rose-500/60", text: "text-rose-700 dark:text-rose-300" },
  slate: { card: "border-line-strong bg-surface-2", icon: "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900", ring: "ring-accent/50", text: "text-fg-2" },
} as const;

type Card = { key: string; label: string; count: number; icon: LucideIcon; tone: keyof typeof TONES; note?: string; urgent?: number };

/**
 * Pending / Approved / Rejected / All as four large cards; clicking one filters
 * the list below (client-side navigation, the page doesn't reload).
 */
export function LeaveStatusCards({
  byStatus,
  urgent,
  active,
  href,
}: {
  byStatus: Record<LeaveStatusKey, number>;
  /** Pending requests waiting more than 48 hours. */
  urgent: number;
  /** The selected status, or null for All. */
  active: LeaveStatusKey | null;
  href: (status: string) => string;
}) {
  const all = byStatus.PENDING + byStatus.APPROVED + byStatus.REJECTED;
  const cards: (Card & { status: LeaveStatusKey | null })[] = [
    { key: "pending", status: "PENDING", label: "Pending requests", count: byStatus.PENDING, icon: Hourglass, tone: "amber", note: "Waiting for a decision", urgent },
    { key: "approved", status: "APPROVED", label: "Approved", count: byStatus.APPROVED, icon: CircleCheck, tone: "green", note: "Shown as Leave in attendance" },
    { key: "rejected", status: "REJECTED", label: "Rejected", count: byStatus.REJECTED, icon: CircleX, tone: "rose", note: "With the reason given" },
    { key: "all", status: null, label: "All requests", count: all, icon: Layers, tone: "slate", note: "Every request" },
  ];
  return (
    <nav aria-label="Filter by status" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((c) => {
        const t = TONES[c.tone];
        const on = c.status === active;
        return (
          <Link
            key={c.key}
            href={href(c.key)}
            scroll={false}
            aria-current={on ? "true" : undefined}
            className={cx(
              "group relative flex flex-col rounded-2xl border p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-5",
              t.card,
              on && `ring-2 ${t.ring}`,
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className={`text-sm font-semibold ${t.text}`}>{c.label}</span>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
                <c.icon className="h-5 w-5" aria-hidden />
              </span>
            </span>
            <span className="mt-2 text-display-sm font-semibold tabular-nums text-fg">{c.count}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              {c.urgent ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 font-semibold text-danger ring-1 ring-inset ring-danger-line">
                  <TriangleAlert className="h-3 w-3" aria-hidden />
                  {c.urgent} waiting over 48h
                </span>
              ) : (
                c.note
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
