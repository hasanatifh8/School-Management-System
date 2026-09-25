"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Tabs across Expenses; the chosen month carries over between them. */
export function ExpensesTabs() {
  const pathname = usePathname();
  const month = useSearchParams().get("month");
  const q = month ? `?month=${month}` : "";
  const tabs = [
    { href: "/admin/expenses", label: "Overview" },
    { href: "/admin/expenses/salaries", label: "Salaries" },
    { href: "/admin/expenses/list", label: "Expenses" },
    { href: "/admin/expenses/budget", label: "Budget" },
  ];
  return (
    <nav className="-mt-4 mb-8 flex gap-6 overflow-x-auto border-b border-slate-200 text-sm font-medium">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={`${t.href}${t.href.endsWith("budget") ? "" : q}`}
          className={`shrink-0 border-b-2 pb-3 transition ${pathname === t.href ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
