import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/* ───────────────────────── Page structure ───────────────────────── */

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-8">
      {breadcrumbs && (
        <nav className="mb-3 flex items-center gap-1 text-xs font-medium text-slate-500">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
              {c.href ? (
                <Link href={c.href} className="hover:text-indigo-600">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-700">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  icon: Icon,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Set false for edge-to-edge content such as tables. */
  padded?: boolean;
}) {
  const hasHeader = title || description || action;
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.08)] ${className}`}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={padded ? "p-6" : ""}>{children}</div>
    </section>
  );
}

/** Heading that splits a long form into groups. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-8 gap-y-4 border-t border-slate-100 pt-8 first:border-0 first:pt-0 lg:grid-cols-[220px_1fr]">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/* ───────────────────────── Buttons & links ───────────────────────── */

const buttonBase =
  "relative inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

export const buttonVariants = {
  primary: `${buttonBase} bg-indigo-600 px-4 py-2.5 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500`,
  secondary: `${buttonBase} border border-slate-200 bg-white px-4 py-2.5 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50`,
  danger: `${buttonBase} bg-rose-600 px-4 py-2.5 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-500`,
  ghost: `${buttonBase} px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900`,
  dangerGhost: `${buttonBase} px-3 py-2 text-rose-600 hover:bg-rose-50`,
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function ButtonLink({
  href,
  children,
  icon: Icon,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
  variant?: ButtonVariant;
}) {
  return (
    <Link href={href} className={buttonVariants[variant]}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </Link>
  );
}

/* ───────────────────────── Data display ───────────────────────── */

const badgeTones = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
} as const;

export function Badge({
  children,
  tone = "slate",
  dot = false,
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

const avatarPalette = [
  "bg-indigo-100 text-indigo-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Initials avatar with a colour that stays stable for the same name. */
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  /** Photo URL; falls back to initials when absent. */
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const sizes = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-lg",
  };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full bg-slate-100 object-cover object-top ${sizes[size]}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${avatarPalette[hash(name) % avatarPalette.length]}`}
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
    <Link href={href} className="font-medium text-slate-900 hover:text-indigo-600">
      {name}
    </Link>
  ) : (
    <span className="font-medium text-slate-900">{name}</span>
  );
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={photoUrl} size={size} />
      <div className="min-w-0">
        <div className="truncate">{nameEl}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

const iconTones = {
  indigo: "bg-indigo-50 text-indigo-600",
  sky: "bg-sky-50 text-sky-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
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
  const sizes = { sm: "h-8 w-8 [&>svg]:h-4 [&>svg]:w-4", md: "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5", lg: "h-12 w-12 [&>svg]:h-6 [&>svg]:w-6" };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${sizes[size]} ${iconTones[tone]}`}>
      <Icon />
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function InfoItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-slate-800">{children}</dd>
      </div>
    </div>
  );
}

/** Underlined tab link with a count, e.g. "Active 12". */
export function StatusTab({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 border-b-2 pb-3 transition ${
        active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
            active ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/* ───────────────────────── Tables & inputs ───────────────────────── */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export const theadClass = "bg-slate-50/80 border-b border-slate-100";
export const thClass =
  "whitespace-nowrap px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500";
export const tbodyClass = "divide-y divide-slate-100";
export const trClass = "transition-colors hover:bg-slate-50/70";
export const tdClass = "px-6 py-3.5 align-middle text-slate-700";

export const inputClass =
  "block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50";

export const selectClass = `${inputClass} select-chevron`;

export const checkboxClass =
  "h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 focus:ring-indigo-500";
