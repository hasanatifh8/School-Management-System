import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedNumber } from "./animated-number";
import { cx } from "./cx";
import { IconTile, type IconTone } from "./data";

/**
 * One key number with a label. Numbers count up; strings (e.g. "12 / 14") are
 * shown as they are. With `href` the whole card is a link that lifts on hover.
 */
export function StatCard({
  label,
  value,
  prefix,
  suffix,
  icon,
  tone = "indigo",
  detail,
  href,
  size = "md",
}: {
  label: string;
  value: number | string;
  /** e.g. "₹" */
  prefix?: string;
  suffix?: string;
  icon?: LucideIcon;
  tone?: IconTone;
  detail?: ReactNode;
  href?: string;
  size?: "md" | "lg";
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
      </div>
      <p
        className={cx(
          "mt-3 font-semibold text-fg",
          size === "lg" ? "text-display-sm sm:text-display" : "text-2xl tracking-tight sm:text-display-sm",
        )}
      >
        {typeof value === "number" ? (
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
        ) : (
          <span className="tabular-nums">
            {prefix}
            {value}
            {suffix}
          </span>
        )}
      </p>
      {detail && (
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
          <span className="truncate">{detail}</span>
          {href && (
            <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-subtle transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
          )}
        </p>
      )}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6";
  return href ? (
    <Link href={href} className={cx(cls, "group transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** 2 columns on phones, `cols` from xl. */
export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const xl = { 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4" }[cols];
  return <div className={cx("grid grid-cols-2 gap-3 sm:gap-4", xl)}>{children}</div>;
}
