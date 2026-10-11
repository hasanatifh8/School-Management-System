"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "@/lib/attendance-shared";

/** Yesterday / Today / Tomorrow shortcuts and a date picker; navigates with ?date=. */
export function DayShortcuts({ basePath, date, today, min, max }: { basePath: string; date: string; today: string; min: string; max: string }) {
  const router = useRouter();
  const href = (d: string) => `${basePath}${basePath.includes("?") ? "&" : "?"}date=${d}`;
  const shortcuts = [
    { label: "Yesterday", d: addDays(today, -1) },
    { label: "Today", d: today },
    { label: "Tomorrow", d: addDays(today, 1) },
  ].filter((s) => s.d >= min && s.d <= max);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Day" className="inline-flex rounded-xl bg-surface-3 p-1">
        {shortcuts.map((s) => (
          <Link
            key={s.label}
            href={href(s.d)}
            aria-current={s.d === date ? "date" : undefined}
            className={`flex h-8 items-center rounded-lg px-3 text-sm font-medium transition ${s.d === date ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <input
        type="date"
        aria-label="Date"
        value={date}
        min={min}
        max={max}
        onChange={(e) => e.target.value && router.push(href(e.target.value))}
        className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-fg shadow-card focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
      />
    </div>
  );
}
