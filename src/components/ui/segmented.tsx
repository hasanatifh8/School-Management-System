"use client";

import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { cx } from "./cx";

export type SegmentOption<T extends string> = { value: T; label: string; icon?: LucideIcon; tone?: string };

/**
 * Pill-style single choice built on real radio inputs, so arrow keys and
 * form submission work natively. `tone` is an extra class for the checked pill.
 */
export function SegmentedControl<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
  iconOnly = false,
}: {
  name?: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
  /** Show only icons (labels become tooltips and screen-reader text). */
  iconOnly?: boolean;
}) {
  const auto = useId();
  const group = name ?? auto;
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-xl bg-surface-3 p-1", className)}>
      {options.map((o) => {
        const checked = o.value === value;
        const Icon = o.icon;
        return (
          <label
            key={o.value}
            title={iconOnly ? o.label : undefined}
            className={cx(
              "relative flex flex-1 cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg font-medium transition duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              checked ? cx("bg-surface text-fg shadow-card", o.tone) : "text-muted hover:text-fg",
            )}
          >
            <input
              type="radio"
              name={group}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            <span className={iconOnly ? "sr-only" : undefined}>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
