"use client";

import { Search, X } from "lucide-react";

/**
 * Search box and status chips above an attendance sheet. Filtering only hides
 * rows, so every mark is still submitted with the form.
 */
export function SheetFilter<S extends string>({
  query,
  onQuery,
  only,
  onOnly,
  statuses,
  counts,
  placeholder,
}: {
  query: string;
  onQuery: (q: string) => void;
  only: S | null;
  onOnly: (s: S | null) => void;
  statuses: { value: S; label: string }[];
  counts: Record<S, number>;
  placeholder: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6 print:hidden">
      <label className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          // Enter in the box must not submit the attendance form.
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-base text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 sm:text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show only">
        {statuses.map((s) => {
          const on = only === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={on}
              onClick={() => onOnly(on ? null : s.value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${on ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
            >
              {s.label} <span className="tabular-nums opacity-70">{counts[s.value]}</span>
              {on && <X className="h-3 w-3" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Whether a row matches the search words (any of its fields contains each word). */
export function matchesQuery(query: string, ...fields: (string | number | null | undefined)[]) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hay = fields.filter((f) => f != null).map((f) => String(f).toLowerCase());
  return words.every((w) => hay.some((h) => h.includes(w)));
}
