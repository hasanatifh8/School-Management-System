"use client";

import Link from "next/link";
import { useState } from "react";

export type ClassAttendance = { id: string; name: string; present: number; absent: number; leave: number };

/** Present and absent students per group (a class, or a day), as paired bars with a hover tooltip. */
export function AttendanceChart({ data, href = "/admin/attendance" }: { data: ClassAttendance[]; href?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.present, d.absent])));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(max * f));

  return (
    <div>
      <Legend items={[{ label: "Present", className: "bg-success-solid" }, { label: "Absent", className: "bg-danger-solid" }]} />
      <div className="mt-4 flex gap-3">
        <div className="flex h-56 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-subtle" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative h-56" style={{ minWidth: data.length * 44 }}>
            {/* Grid */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
              {ticks.map((t) => (
                <span key={t} className={`border-t ${t === 0 ? "border-line-strong" : "border-dashed border-line"}`} />
              ))}
            </div>
            <ul className="absolute inset-0 flex">
              {data.map((d, i) => {
                const total = d.present + d.absent + d.leave;
                const pct = total ? Math.round((d.present / total) * 100) : 0;
                return (
                  <li key={d.id} className="relative flex min-w-0 flex-1 flex-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                    <Link
                      href={href}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      aria-label={`${d.name}: ${d.present} present, ${d.absent} absent`}
                      className={`flex flex-1 items-end justify-center gap-0.5 rounded-t-lg pb-px transition ${hover === i ? "bg-surface-2" : ""}`}
                    >
                      <Bar value={d.present} max={max} className="bg-success-solid" />
                      <Bar value={d.absent} max={max} className="bg-danger-solid" />
                    </Link>
                    <span className="h-6 truncate pt-1.5 text-center text-[11px] text-muted">{d.name}</span>
                    {hover === i && (
                      <Tooltip>
                        <p className="font-semibold text-fg">{d.name}</p>
                        <Row dot="bg-success-solid" label="Present" value={d.present} />
                        <Row dot="bg-danger-solid" label="Absent" value={d.absent} />
                        {d.leave > 0 && <Row dot="bg-surface-3" label="Leave" value={d.leave} />}
                        <p className="mt-1 border-t border-line pt-1 text-muted">{pct}% present</p>
                      </Tooltip>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <span
      className={`w-3 max-w-[40%] rounded-t-[4px] transition-[height] duration-500 sm:w-4 ${className}`}
      style={{ height: `${value ? Math.max(2, (value / max) * 100) : 0}%` }}
    />
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max min-w-32 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {children}
    </div>
  );
}

function Row({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-fg-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
      <span className="ml-auto pl-3 font-semibold tabular-nums text-fg">{value}</span>
    </p>
  );
}

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${i.className}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** A round axis maximum: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceMax(n: number) {
  const p = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 2.5, 5, 10].map((f) => f * p).find((v) => v >= n) ?? n;
}
