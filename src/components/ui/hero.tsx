import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The one gradient surface on a dashboard: today's most important task. The
 * accent gradient is the same in both themes, with white text (AA contrast).
 */
export function HeroCard({
  icon: Icon,
  eyebrow,
  children,
  actions,
  className,
}: {
  icon: LucideIcon;
  eyebrow: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b4ee8] via-[#5a45e0] to-violet-700 p-6 text-white shadow-accent sm:p-8",
        className,
      )}
    >
      <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-eyebrow uppercase text-white/80">
          <Icon className="h-4 w-4" aria-hidden /> {eyebrow}
        </p>
        {children}
        {actions && <div className="mt-8 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

/** White call-to-action button for use on a HeroCard. */
export function HeroLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#4b3fd6] shadow-lift transition hover:-translate-y-px hover:bg-white/90 active:scale-[0.98] [&_svg]:h-4 [&_svg]:w-4"
    >
      {children}
    </Link>
  );
}

/** Quiet outlined link for a HeroCard's secondary action. */
export function HeroGhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white/90 ring-1 ring-inset ring-white/25 transition hover:bg-white/10"
    >
      {children}
    </Link>
  );
}

/** A thin white progress bar for a HeroCard. */
export function HeroProgress({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="mt-6 max-w-md">
      <div className="mb-2 flex justify-between text-xs text-white/80">
        <span>{label}</span>
        <span className="tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="h-full rounded-full bg-white transition-[width] duration-700 ease-out" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
