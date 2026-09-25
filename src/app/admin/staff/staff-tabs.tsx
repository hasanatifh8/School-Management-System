"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/staff", label: "Non-teaching staff" },
    { href: "/admin/staff/logins", label: "Fees logins" },
  ];
  return (
    <nav className="-mt-4 mb-8 flex gap-6 border-b border-slate-200 text-sm font-medium">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`border-b-2 pb-3 transition ${pathname === t.href ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
