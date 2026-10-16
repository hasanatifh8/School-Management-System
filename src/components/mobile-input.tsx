"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

/**
 * Digits only, at most 10. A pasted or typed +91 / 0091 / 91 / 0 prefix is
 * dropped when the number would otherwise be too long.
 */
function clean(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10) {
    if (digits.startsWith("0091")) digits = digits.slice(4);
    else if (digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** What's wrong with a (cleaned) number, or null when it's a valid mobile number or blank. */
function problem(v: string) {
  if (!v) return null;
  if (!/^[6-9]/.test(v)) return "Mobile numbers start with 6, 7, 8 or 9";
  if (v.length < 10) return `Enter all 10 digits (${10 - v.length} more)`;
  if (/^(\d)\1{9}$/.test(v)) return "Enter a real mobile number";
  return null;
}

/**
 * Indian mobile number field: exactly 10 digits starting with 6–9. Only digits
 * can be typed (at most 10); a mistake shows under the box as soon as the field
 * is left, and the form can't be submitted with it. The server checks it again.
 */
export function MobileInput({
  name,
  defaultValue,
  label,
  required,
}: {
  name: string;
  defaultValue?: string | null;
  /** Accessible name when the field has no visible <label>. */
  label?: string;
  required?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const check = (el: HTMLInputElement) => {
    const message = problem(el.value);
    el.setCustomValidity(message ?? "");
    return message;
  };
  return (
    <>
      <div className="relative">
      {/* Fixed country code: only the 10 digits are typed and saved. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-px left-px z-10 flex items-center rounded-l-[calc(0.75rem-1px)] border-r border-line bg-surface-2 px-3 text-sm font-medium tabular-nums text-muted"
      >
        +91
      </span>
      <input
        type="tel"
        name={name}
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        aria-label={label ? `${label} (+91)` : undefined}
        aria-invalid={!!error}
        required={required}
        placeholder="10-digit mobile"
        defaultValue={clean(defaultValue ?? "")}
        onPaste={(e) => {
          // maxLength would cut a pasted "+91 98765 43210" before it's cleaned: clean the whole paste instead.
          e.preventDefault();
          const el = e.currentTarget;
          el.value = clean(e.clipboardData.getData("text"));
          setError(check(el));
        }}
        onInput={(e) => {
          const el = e.currentTarget;
          const next = clean(el.value);
          if (next !== el.value) el.value = next;
          // Keep a shown error up to date while typing; a new one waits for the field to be left.
          if (error) setError(check(el));
          else check(el);
        }}
        onBlur={(e) => setError(check(e.currentTarget))}
        onInvalid={(e) => setError(check(e.currentTarget) ?? (required ? "Enter the mobile number" : null))}
        className={`${inputClass} !pl-16 tabular-nums ${error ? "!border-danger-solid" : ""}`}
      />
      </div>
      {error && <span className="mt-1.5 block text-xs font-medium text-danger">{error}</span>}
    </>
  );
}
