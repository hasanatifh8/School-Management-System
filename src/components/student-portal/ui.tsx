import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";

/** A soft colour per subject, the same everywhere for the same name. */
const SUBJECT_TONES = [
  { chip: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200", bar: "bg-sky-500", ring: "ring-sky-200 dark:ring-sky-500/30", soft: "from-sky-50 dark:from-sky-500/10" },
  { chip: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200", bar: "bg-violet-500", ring: "ring-violet-200 dark:ring-violet-500/30", soft: "from-violet-50 dark:from-violet-500/10" },
  { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200", bar: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-500/30", soft: "from-emerald-50 dark:from-emerald-500/10" },
  { chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200", bar: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-500/30", soft: "from-amber-50 dark:from-amber-500/10" },
  { chip: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200", bar: "bg-rose-500", ring: "ring-rose-200 dark:ring-rose-500/30", soft: "from-rose-50 dark:from-rose-500/10" },
  { chip: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200", bar: "bg-teal-500", ring: "ring-teal-200 dark:ring-teal-500/30", soft: "from-teal-50 dark:from-teal-500/10" },
  { chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200", bar: "bg-indigo-500", ring: "ring-indigo-200 dark:ring-indigo-500/30", soft: "from-indigo-50 dark:from-indigo-500/10" },
  { chip: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-200", bar: "bg-fuchsia-500", ring: "ring-fuchsia-200 dark:ring-fuchsia-500/30", soft: "from-fuchsia-50 dark:from-fuchsia-500/10" },
];
export function subjectTone(name: string | null | undefined) {
  if (!name) return { chip: "bg-surface-3 text-fg-2", bar: "bg-slate-400", ring: "ring-line", soft: "from-surface-2" };
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_TONES[h % SUBJECT_TONES.length];
}

/** Green from 90%, amber from 75%, else red. */
export const scoreTone = (p: number | null) => (p == null ? "text-subtle" : p >= 90 ? "text-emerald-500" : p >= 75 ? "text-amber-500" : "text-rose-500");

/** A progress ring with the value in the middle. */
export function Ring({ value, size = 96, stroke = 10, label, sub }: { value: number | null; size?: number; stroke?: number; label?: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className={cx("stroke-current transition-[stroke-dashoffset] duration-700", scoreTone(value))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold tabular-nums text-fg">{label ?? (value == null ? "—" : `${Math.round(value)}%`)}</span>
        {sub && <span className="text-[10px] font-medium uppercase tracking-wider text-muted">{sub}</span>}
      </div>
    </div>
  );
}

/** A colourful page banner for the student portal: an icon, a title and a line under it. */
export function StudentBanner({ icon: Icon, title, subtitle, tone = "indigo", children }: { icon: LucideIcon; title: string; subtitle?: ReactNode; tone?: "indigo" | "emerald" | "amber" | "rose" | "sky"; children?: ReactNode }) {
  const bg = {
    indigo: "from-indigo-600 via-violet-600 to-fuchsia-500",
    emerald: "from-emerald-600 via-teal-500 to-cyan-500",
    amber: "from-amber-500 via-orange-500 to-rose-500",
    rose: "from-rose-500 via-pink-500 to-fuchsia-500",
    sky: "from-sky-600 via-indigo-500 to-violet-500",
  }[tone];
  return (
    <section className={cx("relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-lift sm:p-7", bg)}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-white/85">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
