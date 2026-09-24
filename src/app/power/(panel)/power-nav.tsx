"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/power", label: "Schools" },
  { href: "/power/activity", label: "Activity log" },
];

export function PowerNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm font-medium">
      {items.map(({ href, label }) => {
        const active = href === "/power" ? pathname === "/power" || pathname.startsWith("/power/schools") : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 transition ${active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
