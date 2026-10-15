"use client";

import { useState } from "react";
import { inputClass, selectClass } from "@/components/ui";
import { formatStudentCode, STUDENT_ID_DIGITS } from "@/lib/codes";

/** Prefix and digit pickers, with a preview of the next ID as it will look. */
export function StudentIdFormatFields({
  prefix: initialPrefix,
  digits: initialDigits,
  year,
  next,
}: {
  prefix: string;
  digits: number;
  year: number;
  next: number;
}) {
  const [prefix, setPrefix] = useState(initialPrefix);
  const [digits, setDigits] = useState(initialDigits);
  const shown = prefix.trim().toUpperCase() || "…";
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-fg-2">Prefix</span>
          <input
            name="prefix"
            required
            maxLength={10}
            pattern="[A-Za-z0-9]+"
            title="Letters and numbers only"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            className={`${inputClass} uppercase`}
          />
          <span className="mt-1 block text-xs text-muted">Letters and numbers, e.g. STU or ADM.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-fg-2">Number digits</span>
          <select name="digits" value={digits} onChange={(e) => setDigits(Number(e.target.value))} className={selectClass}>
            {STUDENT_ID_DIGITS.map((d) => (
              <option key={d} value={d}>
                {d} digits ({"0".repeat(d - 1)}1)
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">The number restarts at 1 each admission year.</span>
        </label>
      </div>
      <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
        <span className="block text-xs text-muted">Next student admitted in {year} gets</span>
        <span className="mt-0.5 block font-mono text-lg font-semibold text-fg">{formatStudentCode(shown, year, next, digits)}</span>
      </div>
    </>
  );
}
