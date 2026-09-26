"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, MoreHorizontal } from "lucide-react";
import { cx } from "./cx";
import { Modal } from "./modal";
import { PageTransition } from "./page-transition";

export type NavItem = {
  href: string;
  label: string;
  /** A rendered icon element, e.g. `<GraduationCap />` (elements can cross the server/client boundary). */
  icon: ReactNode;
  /** Second line under the label (desktop sidebar only). */
  sub?: string;
  /** Only this exact path is "active" (for dashboards). */
  exact?: boolean;
  /** Other path prefixes that also mark this item active. */
  alsoActive?: string[];
};
export type NavGroup = { label?: string; items: NavItem[] };

export function isActive(item: NavItem, pathname: string) {
  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  return (item.exact ? pathname === item.href : under(item.href)) || (item.alsoActive ?? []).some(under);
}

/**
 * Portal chrome shared by the Admin, Teacher and Power portals.
 * - Desktop (lg+): full sidebar.
 * - Tablet (md–lg): icon rail with tooltips.
 * - Phone: frosted top bar + bottom tab bar; everything else in a slide-in drawer.
 */
export function AppShell({
  brand,
  groups,
  footerItems = [],
  mobileTabs,
  account,
  banner,
  children,
}: {
  brand: { logo: ReactNode; title: string; subtitle?: ReactNode };
  groups: NavGroup[];
  /** Pinned above the account card (e.g. Settings). */
  footerItems?: NavItem[];
  /** Up to four hrefs shown in the phone tab bar, in order. */
  mobileTabs: string[];
  /** Signed-in user block; receives nothing, rendered as is. */
  account: ReactNode;
  /** Full-width strip above the page (e.g. "Viewing as Power Admin"). */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const all = [...groups.flatMap((g) => g.items), ...footerItems];
  const tabs = mobileTabs.map((h) => all.find((i) => i.href === h)).filter((i): i is NavItem => !!i);
  const moreActive = !tabs.some((t) => isActive(t, pathname));

  return (
    <div className="min-h-dvh md:flex">
      {/* Tablet rail / desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-surface md:block md:w-[72px] lg:w-64 print:hidden">
        <Sidebar brand={brand} groups={groups} footerItems={footerItems} account={account} pathname={pathname} rail />
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-glass px-4 py-2 backdrop-blur-xl backdrop-saturate-150 md:hidden print:hidden">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          className="-ml-2 rounded-xl p-2 text-fg-2 transition hover:bg-surface-3"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="[&>*]:h-8 [&>*]:w-8">{brand.logo}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{brand.title}</p>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-10 lg:pt-10 print:max-w-none print:p-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Phone tab bar */}
      <nav
        aria-label="Quick"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-glass pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden print:hidden"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <TabLink key={t.href} href={t.href} label={t.label} icon={t.icon} active={isActive(t, pathname)} />
        ))}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className={cx("flex flex-col items-center gap-1 py-2 text-[11px] font-medium", moreActive ? "text-accent-text" : "text-muted")}
        >
          <span className={cx("flex h-7 w-12 items-center justify-center rounded-full transition", moreActive && "bg-accent-soft")}>
            <MoreHorizontal className="h-5 w-5" />
          </span>
          More
        </button>
      </nav>

      <Modal open={drawer} onClose={() => setDrawer(false)} variant="drawer-left">
        <Sidebar
          brand={brand}
          groups={groups}
          footerItems={footerItems}
          account={account}
          pathname={pathname}
          onNavigate={() => setDrawer(false)}
        />
      </Modal>
    </div>
  );
}

function TabLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx("flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition", active ? "text-accent-text" : "text-muted")}
    >
      <span className={cx("flex h-7 w-12 items-center justify-center rounded-full transition [&>svg]:h-5 [&>svg]:w-5", active && "bg-accent-soft")}>
        {icon}
      </span>
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}

function Sidebar({
  brand,
  groups,
  footerItems,
  account,
  pathname,
  rail = false,
  onNavigate,
}: {
  brand: { logo: ReactNode; title: string; subtitle?: ReactNode };
  groups: NavGroup[];
  footerItems: NavItem[];
  account: ReactNode;
  pathname: string;
  /** Collapse to icons between md and lg. */
  rail?: boolean;
  onNavigate?: () => void;
}) {
  const hideOnRail = rail ? "md:max-lg:hidden" : "";
  return (
    <div className="flex h-full flex-col">
      <div className={cx("flex items-center gap-3 px-5 py-6", rail && "md:max-lg:justify-center md:max-lg:px-0")}>
        <span className="shrink-0">{brand.logo}</span>
        <div className={cx("min-w-0 flex-1", hideOnRail)}>
          <p className="truncate text-sm font-semibold text-fg">{brand.title}</p>
          {brand.subtitle && <div className="mt-0.5 truncate text-xs text-muted">{brand.subtitle}</div>}
        </div>
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
        {groups.map((g, gi) => (
          <div key={gi} className={gi > 0 ? "mt-6" : undefined}>
            {g.label && (
              <>
                <p className={cx("mb-2 px-3 text-eyebrow uppercase text-subtle", hideOnRail)}>{g.label}</p>
                {rail && <div className="mx-3 mb-2 hidden h-px bg-line md:max-lg:block" aria-hidden />}
              </>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.href}>
                  <SideLink item={item} active={isActive(item, pathname)} rail={rail} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        {footerItems.length > 0 && (
          <ul className="mb-2 space-y-0.5">
            {footerItems.map((item) => (
              <li key={item.href}>
                <SideLink item={item} active={isActive(item, pathname)} rail={rail} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        )}
        {account}
      </div>
    </div>
  );
}

function SideLink({ item, active, rail, onNavigate }: { item: NavItem; active: boolean; rail: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={rail ? item.label : undefined}
      className={cx(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition duration-150",
        rail && "md:max-lg:justify-center md:max-lg:px-0 md:max-lg:py-2.5",
        active ? "bg-accent-soft text-fg" : "text-muted hover:bg-surface-3 hover:text-fg",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
      <span
        className={cx(
          "shrink-0 transition [&>svg]:h-[18px] [&>svg]:w-[18px]",
          active ? "text-accent-text" : "text-subtle group-hover:text-fg-2",
        )}
      >
        {item.icon}
      </span>
      <span className={cx("min-w-0", rail && "md:max-lg:sr-only")}>
        <span className="block truncate">{item.label}</span>
        {item.sub && <span className="block truncate text-[11px] font-normal text-subtle">{item.sub}</span>}
      </span>
    </Link>
  );
}
