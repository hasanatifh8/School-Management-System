import { CircleCheck, CircleMinus, OctagonAlert, TriangleAlert } from "lucide-react";

export type BudgetStatus = "over" | "risk" | "near" | "under" | "none";

export function budgetStatus(c: { budget: number | null; spent: number; forecast: number }, live: boolean): BudgetStatus {
  if (c.budget == null) return "none";
  if (c.spent > c.budget) return "over";
  if (live && c.forecast > c.budget) return "risk";
  if (c.budget > 0 && c.spent / c.budget >= 0.85) return "near";
  return "under";
}

const META = {
  over: { label: "Over budget", icon: OctagonAlert, cls: "bg-danger-soft text-danger ring-danger-line", bar: "bg-danger-solid" },
  risk: { label: "Likely over", icon: TriangleAlert, cls: "bg-warning-soft text-warning ring-warning-line", bar: "bg-warning-solid" },
  near: { label: "Near limit", icon: TriangleAlert, cls: "bg-warning-soft text-warning ring-warning-line", bar: "bg-warning-solid" },
  under: { label: "Under budget", icon: CircleCheck, cls: "bg-success-soft text-success ring-success-line", bar: "bg-success-solid" },
  none: { label: "No budget", icon: CircleMinus, cls: "bg-surface-3 text-fg-2 ring-line", bar: "bg-line-strong" },
} as const;

export const statusBar = (s: BudgetStatus) => META[s].bar;

/** Status always carries an icon and a word, never colour alone. */
export function StatusPill({ status }: { status: BudgetStatus }) {
  const { label, icon: Icon, cls } = META[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
