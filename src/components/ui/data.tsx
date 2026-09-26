import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/* ───────────────────────── Badges ───────────────────────── */

const badgeTones = {
  slate: "bg-surface-3 text-fg-2 ring-line",
  green: "bg-success-soft text-success ring-success-line",
  red: "bg-danger-soft text-danger ring-danger-line",
  amber: "bg-warning-soft text-warning ring-warning-line",
  indigo: "bg-accent-soft text-accent-text ring-accent-line",
  sky: "bg-info-soft text-info ring-info-line",
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  children,
  tone = "slate",
  dot = false,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/* ───────────────────────── Avatars ───────────────────────── */

// Tinted fills that read well on both light and dark surfaces.
const avatarPalette = [
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const avatarSizes = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
};

/** Initials avatar with a colour that stays stable for the same name. */
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  /** Photo URL; falls back to initials when absent. */
  src?: string | null;
  size?: keyof typeof avatarSizes;
}) {
  // First and last word, so a middle name doesn't change the initials.
  const words = name.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={`shrink-0 rounded-full bg-surface-3 object-cover object-top ring-1 ring-line ${avatarSizes[size]}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarSizes[size]} ${avatarPalette[hash(name) % avatarPalette.length]}`}
    >
      {initials}
    </span>
  );
}

/** Avatar + name + a secondary line, used in tables and lists. */
export function PersonCell({
  name,
  sub,
  href,
  photoUrl,
  size = "md",
}: {
  name: string;
  sub?: ReactNode;
  href?: string;
  photoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const nameEl = href ? (
    <Link href={href} className="rounded font-medium text-fg transition hover:text-accent-text">
      {name}
    </Link>
  ) : (
    <span className="font-medium text-fg">{name}</span>
  );
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} src={photoUrl} size={size} />
      <div className="min-w-0">
        <div className="truncate">{nameEl}</div>
        {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/* ───────────────────────── Icon tiles ───────────────────────── */

const iconTones = {
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  teal: "bg-teal-500/12 text-teal-600 dark:text-teal-300",
  slate: "bg-surface-3 text-fg-2",
} as const;

export type IconTone = keyof typeof iconTones;

export function IconTile({
  icon: Icon,
  tone = "indigo",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4",
    md: "h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5",
    lg: "h-12 w-12 rounded-2xl [&>svg]:h-6 [&>svg]:w-6",
  };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${sizes[size]} ${iconTones[tone]}`}>
      <Icon aria-hidden />
    </span>
  );
}

/* ───────────────────────── Progress ───────────────────────── */

const barTones = {
  accent: "bg-gradient-to-r from-accent to-violet-400",
  success: "bg-success-solid",
  warning: "bg-warning-solid",
  danger: "bg-danger-solid",
  info: "bg-info-solid",
} as const;

/** Thin progress bar; `value` is 0–100. */
export function ProgressBar({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: keyof typeof barTones;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("h-2 overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className={cx("h-full rounded-full transition-[width] duration-500 ease-out", barTones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ───────────────────────── Tables ───────────────────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-x-auto", className)}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export const theadClass = "border-b border-line bg-surface-2";
export const thClass = "whitespace-nowrap px-4 py-3 text-left text-eyebrow uppercase text-muted sm:px-6";
export const tbodyClass = "divide-y divide-line";
export const trClass = "transition-colors hover:bg-surface-2";
export const tdClass = "px-4 py-3 align-middle text-fg-2 sm:px-6";

/** Muted dash for an empty table cell. */
export function Dash() {
  return <span className="text-subtle">—</span>;
}
