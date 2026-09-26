"use client";

import { useSearchParams } from "next/navigation";
import { Banknote, LayoutGrid, Receipt, Target } from "lucide-react";
import { NavTabs } from "@/components/ui";

/** Tabs across Expenses; the chosen month carries over between them. */
export function ExpensesTabs() {
  const month = useSearchParams().get("month");
  const q = month ? `?month=${month}` : "";
  const exact = (href: string) => (p: string) => p === href;
  return (
    <NavTabs
      tabs={[
        { href: `/admin/expenses${q}`, label: "Overview", icon: LayoutGrid, match: exact("/admin/expenses") },
        { href: `/admin/expenses/salaries${q}`, label: "Salaries", icon: Banknote, match: exact("/admin/expenses/salaries") },
        { href: `/admin/expenses/list${q}`, label: "Expenses", icon: Receipt, match: exact("/admin/expenses/list") },
        { href: "/admin/expenses/budget", label: "Budget", icon: Target, match: exact("/admin/expenses/budget") },
      ]}
    />
  );
}
