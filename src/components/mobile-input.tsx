"use client";

import { inputClass } from "@/components/ui";

/** Keeps digits (and a leading +) only, up to a "0091" prefix and 10 digits. */
function clean(raw: string) {
  const plus = raw.trimStart().startsWith("+");
  return ((plus ? "+" : "") + raw.replace(/\D/g, "")).slice(0, 14);
}

/**
 * Indian mobile number field: letters and symbols can't be typed or pasted,
 * and the browser won't submit a number that isn't 10 digits starting with
 * 6–9 (a +91, 0091, 91 or 0 prefix is fine). The server checks it again.
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
  return (
    <input
      type="tel"
      name={name}
      inputMode="numeric"
      autoComplete="tel-national"
      aria-label={label}
      required={required}
      placeholder="10-digit mobile"
      pattern="(\+91|0091|91|0)?[6-9][0-9]{9}"
      title="A 10-digit mobile number starting with 6, 7, 8 or 9"
      defaultValue={defaultValue ?? ""}
      onInput={(e) => {
        const el = e.currentTarget;
        const next = clean(el.value);
        if (next !== el.value) el.value = next;
      }}
      className={`${inputClass} tabular-nums`}
    />
  );
}
