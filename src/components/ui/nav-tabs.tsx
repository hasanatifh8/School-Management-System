"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { StatusTab, tabBarClass } from "./tabs";

export type NavTab = {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Defaults to "this path or anything under it" (exact match for the first tab). */
  match?: (pathname: string) => boolean;
};

/** Section tabs under a page header (Fees, Expenses, Notices, Staff…). */
export function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Section" className="-mt-4 mb-8 border-b border-line print:hidden">
      <div className={tabBarClass}>
        {tabs.map((t, i) => {
          const active = t.match ? t.match(pathname) : i === 0 ? pathname === t.href : pathname.startsWith(t.href);
          return <StatusTab key={t.href} href={t.href} label={t.label} icon={t.icon} active={active} />;
        })}
      </div>
    </nav>
  );
}
