"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, formatISO, monthName } from "@/lib/attendance-shared";

const arrow =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40";

/** Previous / next day, a date picker and a "Today" shortcut. Navigates with ?date=. */
export function DateNav({ basePath, date, min, max }: { basePath: string; date: string; min: string; max: string }) {
  const router = useRouter();
  const href = (d: string) => `${basePath}?date=${d}`;
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
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
      />
      <Link href={href(next)} aria-label="Next day" aria-disabled={next > max} className={arrow}>
        <ChevronRight className="h-4 w-4" />
      </Link>
      {date !== max && (
        <Link href={href(max)} className="ml-1 text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Today
        </Link>
      )}
      <span className="sr-only">{formatISO(date)}</span>
    </div>
  );
}

/** Previous / next month for the register. Navigates with ?month=. */
export function MonthNav({ basePath, month, min, max }: { basePath: string; month: string; min: string; max: string }) {
  const href = (m: string) => `${basePath}?month=${m}`;
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  return (
    <div className="flex items-center gap-2">
      <Link href={href(prev)} aria-label="Previous month" aria-disabled={prev < min} className={arrow}>
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold text-slate-900">{formatISO(`${month}-01`, monthName)}</span>
      <Link href={href(next)} aria-label="Next month" aria-disabled={next > max} className={arrow}>
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
