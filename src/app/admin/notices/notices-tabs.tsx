"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NoticesTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/notices", label: "Send notice", active: pathname === "/admin/notices" },
    { href: "/admin/notices/sent", label: "Sent", active: pathname === "/admin/notices/sent" || /^\/admin\/notices\/c/.test(pathname) },
    { href: "/admin/notices/settings", label: "WhatsApp & SMS settings", active: pathname === "/admin/notices/settings" },
  ];
  return (
    <nav className="-mt-4 mb-8 flex gap-6 overflow-x-auto border-b border-slate-200 text-sm font-medium">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`shrink-0 border-b-2 pb-3 transition ${t.active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
