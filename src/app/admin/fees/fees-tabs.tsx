"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tabs across the Fees section. "Fee structure" is for admins only. */
export function FeesTabs({ canManage }: { canManage: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/fees", label: "Overview", match: (p: string) => p === "/admin/fees" },
    { href: "/admin/fees/collect", label: "Collect fees", match: (p: string) => p.startsWith("/admin/fees/collect") || p.startsWith("/admin/fees/students") },
    { href: "/admin/fees/receipts", label: "Receipts", match: (p: string) => p.startsWith("/admin/fees/receipts") },
    { href: "/admin/fees/structure", label: canManage ? "Fee structure" : "Fee chart", match: (p: string) => p.startsWith("/admin/fees/structure") },
  ];
  return (
    <nav className="-mt-4 mb-8 flex gap-6 overflow-x-auto border-b border-slate-200 text-sm font-medium print:hidden">
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 border-b-2 pb-3 transition ${active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
