"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatISO } from "@/lib/attendance-shared";

const arrow =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 aria-disabled:pointer-events-none aria-disabled:opacity-40";

/** Previous / next day, a date picker and a "Today" shortcut. Navigates with ?date= (kept after any query in `basePath`). */
export function DateNav({ basePath, date, min, max }: { basePath: string; date: string; min: string; max: string }) {
  const router = useRouter();
  const href = (d: string) => `${basePath}${basePath.includes("?") ? "&" : "?"}date=${d}`;
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(prev)} aria-label="Previous day" aria-disabled={prev < min} className={arrow}>
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <input
        type="date"
        aria-label="Date"
        value={date}
        min={min}
        max={max}
        onChange={(e) => e.target.value && router.push(href(e.target.value))}
        className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-fg shadow-card focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
      />
      <Link href={href(next)} aria-label="Next day" aria-disabled={next > max} className={arrow}>
        <ChevronRight className="h-4 w-4" />
      </Link>
      {date !== max && (
        <Link href={href(max)} className="ml-1 text-sm font-medium text-accent-text underline-offset-4 hover:underline">
          Today
        </Link>
      )}
      <span className="sr-only">{formatISO(date)}</span>
    </div>
  );
}
