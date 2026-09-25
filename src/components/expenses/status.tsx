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
  over: { label: "Over budget", icon: OctagonAlert, cls: "bg-rose-50 text-rose-700 ring-rose-200", bar: "bg-rose-500" },
  risk: { label: "Likely over", icon: TriangleAlert, cls: "bg-amber-50 text-amber-800 ring-amber-200", bar: "bg-amber-500" },
  near: { label: "Near limit", icon: TriangleAlert, cls: "bg-amber-50 text-amber-800 ring-amber-200", bar: "bg-amber-500" },
  under: { label: "Under budget", icon: CircleCheck, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500" },
  none: { label: "No budget", icon: CircleMinus, cls: "bg-slate-100 text-slate-600 ring-slate-200", bar: "bg-slate-400" },
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
