import Link from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0";

const variants = {
  primary: "bg-accent text-accent-fg shadow-accent hover:-translate-y-px hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-fg shadow-card hover:bg-surface-2",
  ghost: "text-fg-2 hover:bg-surface-3 hover:text-fg",
  danger: "bg-danger-solid text-white hover:-translate-y-px hover:brightness-110",
  dangerGhost: "text-danger hover:bg-danger-soft",
} as const;

const sizes = {
  sm: "h-8 px-3",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass({ variant = "primary", size = "md" }: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return cx(base, variants[variant], sizes[size]);
}

/** Class strings for each variant at the default size (kept for existing call sites). */
export const buttonVariants = Object.fromEntries(
  (Object.keys(variants) as ButtonVariant[]).map((v) => [v, buttonClass({ variant: v })]),
) as Record<ButtonVariant, string>;

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass({ variant, size }), className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" /> : Icon && <Icon />}
      {children}
    </button>
  );
}

/** Square icon-only button. `label` is required for screen readers and shown as a tooltip. */
export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const square = { sm: "!w-8 !px-0", md: "!w-10 !px-0", lg: "!w-12 !px-0" }[size];
  return (
    <button type={type} aria-label={label} title={label} className={cx(buttonClass({ variant, size }), square, className)} {...props}>
      <Icon />
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  icon: Icon,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link href={href} className={cx(buttonClass({ variant, size }), className)}>
      {Icon && <Icon />}
      {children}
    </Link>
  );
}

/** Small accent text link, e.g. "View all" in a card header. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cx("rounded-md text-sm font-medium text-accent-text transition hover:text-accent-hover hover:underline underline-offset-4", className)}
    >
      {children}
    </Link>
  );
}
