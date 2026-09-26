import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths } from "@/lib/attendance-shared";
import { MONTH_NAMES } from "@/lib/fees-shared";

const arrow = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 aria-disabled:pointer-events-none aria-disabled:opacity-40";

/** ‹ September 2026 › — months up to `max`. */
export function MonthPicker({ basePath, month, max, current }: { basePath: string; month: string; max: string; current: string }) {
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`${basePath}?month=${prev}`} aria-label="Previous month" className={arrow}>
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-40 text-center text-base font-semibold text-fg">
        {MONTH_NAMES[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
      </span>
      <Link href={`${basePath}?month=${next}`} aria-label="Next month" aria-disabled={next > max} className={arrow}>
        <ChevronRight className="h-4 w-4" />
      </Link>
      {month !== current && (
        <Link href={`${basePath}?month=${current}`} className="ml-1 text-sm font-medium text-accent-text underline-offset-4 hover:underline">
          This month
        </Link>
      )}
    </div>
  );
}
