import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";

export const tabBarClass = "-mb-px flex gap-6 overflow-x-auto text-sm font-medium [scrollbar-width:none]";

/** Underlined tab link with an optional count, e.g. "Active 12". Wrap several in `tabBarClass`. */
export function StatusTab({
  href,
  active,
  label,
  count,
  icon: Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cx(
        "relative flex shrink-0 items-center gap-2 rounded-t-md pb-3 pt-1 transition-colors",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors",
        active ? "text-fg after:bg-accent" : "text-muted after:bg-transparent hover:text-fg",
      )}
    >
      {Icon && <Icon className={cx("h-4 w-4", active ? "text-accent-text" : "text-subtle")} aria-hidden />}
      {label}
      {count !== undefined && (
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-xs tabular-nums",
            active ? "bg-accent-soft text-accent-text" : "bg-surface-3 text-muted",
          )}
        >
          {count.toLocaleString("en-IN")}
        </span>
      )}
    </Link>
  );
}
