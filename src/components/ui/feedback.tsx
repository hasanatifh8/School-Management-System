import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** A four-point sparkle for the spot illustrations. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cx("absolute", className)}>
      <path fill="currentColor" d="M8 0c.5 4.2 3.8 7.5 8 8-4.2.5-7.5 3.8-8 8-.5-4.2-3.8-7.5-8-8C4.2 7.5 7.5 4.2 8 0Z" />
    </svg>
  );
}

/**
 * Spot illustration built around an icon: a soft glow, an orbit ring, a tilted
 * back card and sparkles. Same language across every empty/success screen.
 */
export function SpotIllustration({
  icon: Icon,
  tone = "accent",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: "accent" | "success" | "muted";
  size?: "sm" | "md";
}) {
  const t = {
    accent: { glow: "from-accent/20", tile: "text-accent-text", ring: "border-accent-line" },
    success: { glow: "from-success-solid/25", tile: "text-success", ring: "border-success-line" },
    muted: { glow: "from-subtle/20", tile: "text-muted", ring: "border-line-strong" },
  }[tone];
  const box = size === "sm" ? "h-20 w-20" : "h-28 w-28";
  return (
    <div className={cx("relative mx-auto", box)} aria-hidden>
      <div className={cx("absolute inset-0 rounded-full bg-radial to-transparent to-70%", t.glow)} />
      <div className={cx("absolute inset-3 rounded-full border border-dashed", t.ring)} />
      <div className="absolute left-1/2 top-1/2 h-12 w-10 -translate-x-[70%] -translate-y-[45%] -rotate-12 rounded-xl border border-line bg-surface-3" />
      <div
        className={cx(
          "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-line bg-surface shadow-lift",
          size === "sm" ? "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5" : "h-14 w-14 [&>svg]:h-6 [&>svg]:w-6",
          t.tile,
        )}
      >
        <Icon strokeWidth={1.75} />
      </div>
      <Sparkle className="right-2 top-3 h-3 w-3 text-warning-solid" />
      <Sparkle className="bottom-4 left-2 h-2 w-2 text-accent" />
      <Sparkle className="bottom-2 right-5 h-1.5 w-1.5 text-info-solid" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Smaller version for side cards. */
  compact?: boolean;
}) {
  return (
    <div className={cx("flex animate-rise flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-12")}>
      <SpotIllustration icon={icon} size={compact ? "sm" : "md"} tone="muted" />
      <p className={cx("font-semibold text-fg", compact ? "mt-3 text-sm" : "mt-4 text-base")}>{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Celebratory confirmation after finishing a task (payment saved, attendance done…). */
export function SuccessState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="status" className="flex animate-rise flex-col items-center px-6 py-12 text-center">
      <div className="relative h-28 w-28" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-radial from-success-solid/25 to-transparent to-70%" />
        <svg viewBox="0 0 64 64" className="absolute inset-4 animate-pop">
          <circle cx="32" cy="32" r="28" className="fill-success-solid" />
          <path d="M20 33l8 8 16-17" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="check-draw" />
        </svg>
        <Sparkle className="right-1 top-2 h-3 w-3 text-warning-solid" />
        <Sparkle className="bottom-3 left-1 h-2.5 w-2.5 text-accent" />
        <Sparkle className="left-4 top-1 h-1.5 w-1.5 text-info-solid" />
      </div>
      <p className="mt-4 text-h2 font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Skeletons ───────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

function SkeletonHeader() {
  return (
    <div className="mb-8 space-y-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Loading placeholder for list pages: header, toolbar and table rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <SkeletonHeader />
      <div className="rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex gap-2 border-b border-line p-4 sm:px-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="hidden h-10 w-36 sm:block" />
        </div>
        <div className="divide-y divide-line">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Loading placeholder for dashboards: stat tiles and two panels. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <SkeletonHeader />
      <Skeleton className="mb-6 h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

/** Loading placeholder for detail/form pages. */
export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <SkeletonHeader />
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
