"use client";

import { useEffect, useRef, useState } from "react";
import { Legend, niceMax } from "./attendance-chart";

export type FeeMonth = { month: string; label: string; due: number; collected: number };

const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

/**
 * Running totals over the session: fees due (dashed) against fees collected
 * (solid, shaded). The gap between them is what is still pending.
 */
export function FeeTrendChart({ data }: { data: FeeMonth[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.due, d.collected])));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = (key: "due" | "collected") => data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[key])}`).join(" ");
  const area = `${path("collected")} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  const h = hover != null ? data[hover] : null;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
    setHover(Math.min(data.length - 1, Math.max(0, Math.round(px / (step || 1)))));
  }

  return (
    <div>
      <Legend items={[{ label: "Collected", className: "bg-accent" }, { label: "Due (running total)", className: "border-2 border-dashed border-subtle bg-transparent" }]} />
      <div ref={ref} className="relative mt-4" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Fees due and collected by month">
            <defs>
              <linearGradient id="fee-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? "4 4" : undefined} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
                  {compactRupees(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => (
              <text key={d.month} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                {d.label}
              </text>
            ))}
            {h && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={y(0)} stroke="var(--line-strong)" />}
            <path d={area} fill="url(#fee-area)" />
            <path d={path("due")} fill="none" stroke="var(--subtle)" strokeWidth={2} strokeDasharray="6 5" strokeLinejoin="round" />
            <path d={path("collected")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) => (
              <g key={d.month}>
                <circle cx={x(i)} cy={y(d.due)} r={hover === i ? 5 : 3.5} fill="var(--surface)" stroke="var(--subtle)" strokeWidth={2} />
                <circle cx={x(i)} cy={y(d.collected)} r={hover === i ? 5 : 3.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
              </g>
            ))}
            <rect
              x={PAD.left}
              y={0}
              width={innerW}
              height={H - PAD.bottom}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}
        {h && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-max min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop"
            style={x(hover!) > width / 2 ? { right: width - x(hover!) + 12 } : { left: x(hover!) + 12 }}
          >
            <p className="font-semibold text-fg">Up to end of {h.label}</p>
            <TipRow dot="bg-accent" label="Collected" value={h.collected} />
            <TipRow dot="border-2 border-dashed border-subtle" label="Due" value={h.due} />
            <p className="mt-1 flex justify-between gap-3 border-t border-line pt-1 text-muted">
              Pending <span className="font-semibold tabular-nums text-fg">{rupees(Math.max(0, h.due - h.collected))}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TipRow({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-fg-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
      <span className="ml-auto pl-3 font-semibold tabular-nums text-fg">{rupees(value)}</span>
    </p>
  );
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** ₹0, ₹500, ₹15K, ₹2.5L, ₹1.2Cr */
export function compactRupees(n: number) {
  const fmt = (v: number, unit: string) => `₹${Number(v.toFixed(1))}${unit}`;
  if (n >= 1e7) return fmt(n / 1e7, "Cr");
  if (n >= 1e5) return fmt(n / 1e5, "L");
  if (n >= 1e3) return fmt(n / 1e3, "K");
  return `₹${Math.round(n)}`;
}
