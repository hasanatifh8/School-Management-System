import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/* ───────────────────────── Page structure ───────────────────────── */

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs font-medium text-muted">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-subtle" aria-hidden />}
          {c.href ? (
            <Link href={c.href} className="rounded transition hover:text-accent-text">
              {c.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-fg-2">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Page title row. Keep ONE primary button in `action`; put the rest in a
 * <MoreMenu> next to it.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  eyebrow,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Small label above the title, e.g. "Session 2026–27". */
  eyebrow?: ReactNode;
  /** Shown before the title, e.g. an avatar. */
  leading?: ReactNode;
}) {
  return (
    <header className="mb-8 print:mb-4">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 text-eyebrow uppercase text-muted">{eyebrow}</p>}
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-h1">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
        </div>
        {action && <div className="flex flex-wrap items-center gap-2 print:hidden">{action}</div>}
      </div>
    </header>
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
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Set false for edge-to-edge content such as tables. */
  padded?: boolean;
  id?: string;
}) {
  const hasHeader = title || description || action;
  return (
    <section id={id} className={cx("overflow-clip rounded-2xl border border-line bg-surface shadow-card", className)}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={padded ? "p-4 sm:p-6" : ""}>{children}</div>
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
    <div className="grid gap-x-8 gap-y-4 border-t border-line pt-8 first:border-0 first:pt-0 lg:grid-cols-[220px_1fr]">
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-muted">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
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
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
      <div className="min-w-0">
        <dt className="text-eyebrow uppercase text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-fg">{children}</dd>
      </div>
    </div>
  );
}

const calloutTones = {
  accent: { box: "border-accent-line bg-accent-soft text-fg", icon: "text-accent-text" },
  info: { box: "border-info-line bg-info-soft text-fg", icon: "text-info" },
  success: { box: "border-success-line bg-success-soft text-fg", icon: "text-success" },
  warning: { box: "border-warning-line bg-warning-soft text-fg", icon: "text-warning" },
  danger: { box: "border-danger-line bg-danger-soft text-fg", icon: "text-danger" },
} as const;

/** A highlighted strip for page-level notes ("School holiday", "Promotion in progress"). */
export function Callout({
  icon: Icon,
  tone = "accent",
  children,
  action,
  href,
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof calloutTones;
  children: ReactNode;
  /** Text shown at the end, e.g. "Continue →". */
  action?: ReactNode;
  href?: string;
  className?: string;
}) {
  const t = calloutTones[tone];
  const body = (
    <>
      <Icon className={cx("h-5 w-5 shrink-0", t.icon)} aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {action && <span className={cx("shrink-0 font-medium", t.icon)}>{action}</span>}
    </>
  );
  const cls = cx("flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-4 text-sm sm:px-6", t.box, className);
  return href ? (
    <Link href={href} className={cx(cls, "transition hover:-translate-y-px hover:shadow-lift")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Save / Cancel row at the end of a long form inside a padded <Card>. It sticks
 * to the bottom of the screen while the form scrolls (above the phone tab bar).
 */
export function FormActions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-glass px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 md:bottom-0">
      {note && <div className="mr-auto text-sm text-muted">{note}</div>}
      {children}
    </div>
  );
}
