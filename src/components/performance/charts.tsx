// Charts for the Performance Analytics Report: plain SVG drawn on the server,
// sized for an A4 page and readable in black-and-white (every series also
// differs by shape or dash, and values are printed on the marks).
import type { MonthAttendance, SubjectRow } from "@/lib/performance";

const W = 560;
const ink = "fill-slate-800";
const quiet = "fill-slate-500";
const round = (n: number) => String(Math.round(n));
const monthName = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

/** Horizontal gridlines at 0, 25, 50, 75 and 100% with their labels. */
function Grid({ x0, x1, y }: { x0: number; x1: number; y: (v: number) => number }) {
  return (
    <g>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} className="stroke-slate-200" strokeWidth={v === 0 ? 1 : 0.75} />
          <text x={x0 - 6} y={y(v) + 3} textAnchor="end" fontSize="9" className={quiet}>
            {v}%
          </text>
        </g>
      ))}
    </g>
  );
}

export function Legend({ items }: { items: { label: string; swatch: "solid" | "dashed" | "mid" | "outline" | "square" | "circle" | "limit" }[] }) {
  return (
    <span className="flex flex-wrap gap-x-[4mm] gap-y-[1mm] text-[7.5pt] text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-[1.5mm]">
          <svg width="18" height="8" aria-hidden>
            {i.swatch === "solid" && <rect width="18" height="8" rx="1.5" className="fill-indigo-600" />}
            {i.swatch === "limit" && <line x1="0" x2="18" y1="4" y2="4" className="stroke-rose-500" strokeWidth="1.5" strokeDasharray="2 2" />}
            {i.swatch === "mid" && <rect width="18" height="8" rx="1.5" className="fill-slate-400" />}
            {i.swatch === "outline" && <rect x="0.5" y="0.5" width="17" height="7" rx="1.5" className="fill-slate-200 stroke-slate-400" />}
            {i.swatch === "dashed" && <line x1="0" x2="18" y1="4" y2="4" className="stroke-slate-500" strokeWidth="1.5" strokeDasharray="3 2" />}
            {i.swatch === "circle" && <circle cx="9" cy="4" r="3.5" className="fill-indigo-600" />}
            {i.swatch === "square" && <rect x="5" y="0.5" width="7" height="7" className="fill-indigo-900" />}
          </svg>
          {i.label}
        </span>
      ))}
    </span>
  );
}

/**
 * The student's overall percentage at every class test and exam in date order
 * (tests as circles, exams as squares), with the class average dashed.
 */
export function ProgressChart({ points }: { points: { label: string; value: number | null; kind: "EXAM" | "TEST"; classAvg: number | null }[] }) {
  const H = 165;
  const x0 = 40;
  const x1 = W - 16;
  const y = (v: number) => 20 + (1 - v / 100) * (H - 56);
  const step = points.length > 1 ? (x1 - x0 - 24) / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? x0 + 12 + i * step : (x0 + x1) / 2);
  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Overall percentage at each class test and exam">
      <Grid x0={x0} x1={x1} y={y} />
      <polyline points={line(points.map((p) => p.classAvg))} fill="none" className="stroke-slate-500" strokeWidth="1.25" strokeDasharray="4 3" />
      <polyline points={line(points.map((p) => p.value))} fill="none" className="stroke-indigo-600" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          {p.value == null ? (
            <>
              <circle cx={x(i)} cy={y(0)} r="4" fill="white" className="stroke-slate-500" strokeWidth="1.25" />
              <text x={x(i)} y={y(0) - 8} textAnchor="middle" fontSize="8.5" className={quiet}>
                AB
              </text>
            </>
          ) : (
            <>
              {p.kind === "EXAM" ? <rect x={x(i) - 4.5} y={y(p.value) - 4.5} width="9" height="9" className="fill-indigo-900" /> : <circle cx={x(i)} cy={y(p.value)} r="4" className="fill-indigo-600" />}
              <text x={x(i)} y={y(p.value) - 9} textAnchor="middle" fontSize="9" fontWeight="600" className={ink}>
                {round(p.value)}
              </text>
            </>
          )}
          <text x={x(i)} y={H - 18} textAnchor="middle" fontSize="8.5" fontWeight={p.kind === "EXAM" ? 600 : 400} className={p.kind === "EXAM" ? ink : quiet}>
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Attendance per month (bars) against the class (dashed), with the 75% line most schools require. */
export function AttendanceChart({ months }: { months: MonthAttendance[] }) {
  const H = 150;
  const x0 = 40;
  const x1 = W - 16;
  const y = (v: number) => 14 + (1 - v / 100) * (H - 44);
  const slot = (x1 - x0) / Math.max(months.length, 1);
  const bw = Math.min(26, slot * 0.55);
  const cx = (i: number) => x0 + slot * i + slot / 2;
  const cls = months.map((m, i) => (m.classPercent == null ? null : `${cx(i)},${y(m.classPercent)}`)).filter(Boolean);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attendance by month against the class">
      <Grid x0={x0} x1={x1} y={y} />
      <line x1={x0} x2={x1} y1={y(75)} y2={y(75)} className="stroke-rose-500" strokeWidth="1" strokeDasharray="2 2" />
      {months.map((m, i) => (
        <g key={m.month}>
          {m.percent != null && (
            <>
              <rect x={cx(i) - bw / 2} y={y(m.percent)} width={bw} height={y(0) - y(m.percent)} rx="2" className={m.percent < 75 ? "fill-rose-500" : "fill-indigo-600"} />
              {/* At the bar's foot when it is tall enough, clear of the class marker at its top. */}
              <text x={cx(i)} y={m.percent >= 15 ? y(0) - 5 : y(m.percent) - 4} textAnchor="middle" fontSize="8.5" fontWeight="600" className={m.percent >= 15 ? "fill-white" : ink}>
                {round(m.percent)}
              </text>
            </>
          )}
          <text x={cx(i)} y={H - 16} textAnchor="middle" fontSize="8.5" className={quiet}>
            {monthName.format(new Date(`${m.month}-01T00:00:00Z`))}
          </text>
        </g>
      ))}
      {cls.length > 1 && <polyline points={cls.join(" ")} fill="none" className="stroke-slate-500" strokeWidth="1.25" strokeDasharray="4 3" />}
      {months.map((m, i) => m.classPercent != null && <circle key={m.month} cx={cx(i)} cy={y(m.classPercent)} r="2.5" fill="white" className="stroke-slate-500" strokeWidth="1.25" />)}
    </svg>
  );
}

/** Each subject in the latest exam: the student, the class average and the class highest (numbers only, no names). */
export function SubjectBars({ subjects }: { subjects: SubjectRow[] }) {
  const H = 128;
  const x0 = 40;
  const x1 = W - 16;
  const y = (v: number) => 16 + (1 - v / 100) * (H - 54);
  const slot = (x1 - x0) / Math.max(subjects.length, 1);
  const bw = Math.min(16, (slot - 12) / 3);
  const left = (i: number) => x0 + slot * i + (slot - bw * 3 - 4) / 2;
  const bar = (v: number | null, x: number, cls: string) => (v == null ? null : <rect x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx="1.5" className={cls} />);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Subject scores against the class average and highest">
      <Grid x0={x0} x1={x1} y={y} />
      {subjects.map((s, i) => (
        <g key={s.subjectId}>
          {bar(s.exam, left(i), "fill-indigo-600")}
          {bar(s.classAvg, left(i) + bw + 2, "fill-slate-400")}
          {bar(s.classHigh, left(i) + 2 * (bw + 2), "fill-slate-200 stroke-slate-400")}
          {s.exam != null ? (
            <text x={left(i) + bw / 2} y={y(s.exam) - 4} textAnchor="middle" fontSize="8.5" fontWeight="600" className={ink}>
              {round(s.exam)}
            </text>
          ) : (
            <text x={left(i) + bw / 2} y={y(0) - 4} textAnchor="middle" fontSize="8.5" className={quiet}>
              AB
            </text>
          )}
          <text x={x0 + slot * i + slot / 2} y={H - 22} textAnchor="middle" fontSize="8.5" className={ink}>
            {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Subject balance: the student's latest-exam scores (filled) against the class average (dashed), one spoke per subject. */
export function RadarChart({ subjects }: { subjects: SubjectRow[] }) {
  const size = 232;
  const vw = 400;
  const c = size / 2;
  const cx0 = vw / 2;
  const r = 84;
  const n = subjects.length;
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx0 + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const;
  };
  const shape = (vals: (number | null)[]) => vals.map((v, i) => at(i, v ?? 0).join(",")).join(" ");
  const hasAvg = subjects.some((s) => s.classAvg != null);
  return (
    <svg viewBox={`0 0 ${vw} ${size}`} className="w-full" role="img" aria-label="Subject balance against the class average">
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={shape(subjects.map(() => v))} fill="none" className="stroke-slate-200" strokeWidth="0.75" />
      ))}
      {subjects.map((s, i) => {
        const [ex, ey] = at(i, 100);
        const [lx, ly] = at(i, 116);
        return (
          <g key={s.subjectId}>
            <line x1={cx0} y1={c} x2={ex} y2={ey} className="stroke-slate-200" strokeWidth="0.75" />
            <text x={lx} y={ly + 5} textAnchor={Math.abs(lx - cx0) < 8 ? "middle" : lx > cx0 ? "start" : "end"} fontSize="14" className={ink}>
              {s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}
            </text>
          </g>
        );
      })}
      {hasAvg && <polygon points={shape(subjects.map((s) => s.classAvg))} fill="none" className="stroke-slate-500" strokeWidth="1.25" strokeDasharray="4 3" />}
      <polygon points={shape(subjects.map((s) => s.exam))} className="fill-indigo-600/20 stroke-indigo-600" strokeWidth="2" />
      {subjects.map((s, i) => {
        if (s.exam == null) return null;
        const [px, py] = at(i, s.exam);
        return <circle key={s.subjectId} cx={px} cy={py} r="2.5" className="fill-indigo-600" />;
      })}
    </svg>
  );
}

/** Class tests (average) against the latest exam, per subject, as paired horizontal bars. */
export function TestsVsExamChart({ subjects }: { subjects: SubjectRow[] }) {
  const rowH = 19;
  const H = subjects.length * rowH + 10;
  const x0 = 88;
  const x1 = 222;
  const x = (v: number) => x0 + (v / 100) * (x1 - x0);
  return (
    <svg viewBox={`0 0 280 ${H}`} className="w-full" role="img" aria-label="Class tests against the latest exam, per subject">
      {[0, 50, 100].map((v) => (
        <line key={v} x1={x(v)} x2={x(v)} y1="2" y2={H - 4} className="stroke-slate-200" strokeWidth="0.75" />
      ))}
      {subjects.map((s, i) => {
        const top = 4 + i * rowH;
        const gap = s.tests != null && s.exam != null && Math.abs(s.tests - s.exam) >= 15;
        return (
          <g key={s.subjectId}>
            <text x={x0 - 6} y={top + 13} textAnchor="end" fontSize="9" className={ink}>
              {s.name.length > 13 ? `${s.name.slice(0, 12)}…` : s.name}
            </text>
            {s.tests != null ? <rect x={x0} y={top + 3} width={x(s.tests) - x0} height="6.5" rx="1.5" className="fill-slate-400" /> : null}
            {s.exam != null ? <rect x={x0} y={top + 10.5} width={x(s.exam) - x0} height="6.5" rx="1.5" className="fill-indigo-600" /> : null}
            <text x={x(Math.max(s.tests ?? 0, s.exam ?? 0)) + 4} y={top + 14} fontSize="8.5" className={gap ? "fill-amber-700" : quiet} fontWeight={gap ? 600 : 400}>
              {s.tests != null ? round(s.tests) : "–"} / {s.exam != null ? round(s.exam) : "–"}
              {gap ? " !" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A tiny line of one subject's scores in date order, for the table (exams drawn as squares). */
export function Sparkline({ history }: { history: SubjectRow["history"] }) {
  const w = 70;
  const h = 18;
  const pts = history.map((p, i) => ({ ...p, x: history.length > 1 ? 3 + (i * (w - 6)) / (history.length - 1) : w / 2, y: p.percent == null ? null : 2 + (1 - p.percent / 100) * (h - 4) }));
  const line = pts
    .filter((p) => p.y != null)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="inline-block align-middle">
      <polyline points={line} fill="none" className="stroke-indigo-600" strokeWidth="1.25" />
      {pts.map((p, i) =>
        p.y == null ? (
          <circle key={i} cx={p.x} cy={h - 2} r="1.5" fill="white" className="stroke-slate-500" strokeWidth="0.75" />
        ) : p.kind === "EXAM" ? (
          <rect key={i} x={p.x - 1.75} y={p.y - 1.75} width="3.5" height="3.5" className="fill-indigo-900" />
        ) : (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" className="fill-indigo-600" />
        ),
      )}
    </svg>
  );
}
