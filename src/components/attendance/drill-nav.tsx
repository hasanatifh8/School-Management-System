import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Crumb } from "@/components/ui";

/**
 * Sticky bar on attendance and leave drill-down screens: a persistent
 * "Back to Dashboard" button and the breadcrumb trail.
 */
export function DrillNav({ items, dashboard = "/admin" }: { items: Crumb[]; dashboard?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="sticky top-[3.25rem] z-20 -mx-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-glass px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 md:top-0 lg:-mx-10 lg:px-10 print:hidden"
    >
      <Link
        href={dashboard}
        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg-2 shadow-card transition hover:border-line-strong hover:text-accent-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back to Dashboard
      </Link>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-medium text-muted">
        {[{ label: "Dashboard", href: dashboard }, ...items].map((c, i, all) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-subtle" aria-hidden />}
            {c.href && i < all.length - 1 ? (
              <Link href={c.href} className="rounded transition hover:text-accent-text">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-fg-2">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
