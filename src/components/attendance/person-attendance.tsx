import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, TableProperties } from "lucide-react";
import { Card, cx, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { addMonths, isWeeklyOff, monthDates, monthName, parseISODate } from "@/lib/attendance-shared";

const arrow =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 aria-disabled:pointer-events-none aria-disabled:opacity-40";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const shortMonth = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
export const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const percentTone = (p: number | null) => (p == null ? "text-subtle" : p >= 90 ? "text-success" : p >= 75 ? "text-warning" : "text-danger");

type StatusMeta = { label: string; short: string; on: string; bar: string };
export type AttendanceCount = { label: string; value: number; cls?: string };
export type AttendanceMonthRow = { month: string; cells: AttendanceCount[]; percent: number | null };

/**
 * One person's attendance on their profile (a student, teacher or staff
 * member): the session's totals, the chosen month as a calendar register,
 * and every month's totals, with a link to the whole group's register.
 */
export function PersonAttendanceView({
  session,
  percent,
  subtitle,
  counts,
  note,
  aside,
  month,
  minMonth,
  maxMonth,
  today,
  statuses,
  meta,
  marks,
  remarks = {},
  holidays,
  onLeave,
  since,
  flagUnmarked,
  saturdayOff,
  monthLine,
  monthRows,
  monthHref,
  registerHref,
  registerLabel,
}: {
  session: string;
  /** Session percentage; null when nothing is marked yet. */
  percent: number | null;
  subtitle?: string;
  counts: AttendanceCount[];
  note: string;
  /** Small text beside the percentage, e.g. days not marked. */
  aside?: string;
  /** The month shown in the register (YYYY-MM). */
  month: string;
  minMonth: string;
  maxMonth: string;
  today: string;
  statuses: readonly string[];
  meta: Record<string, StatusMeta>;
  /** Date → status key. */
  marks: Record<string, string>;
  remarks?: Record<string, string>;
  /** Date → holiday name. */
  holidays: Map<string, string>;
  /** Unmarked days on approved leave. */
  onLeave: Set<string>;
  /** Days before this are not tracked (blank, never "not marked"). */
  since: string;
  /** Show unmarked past school days as "not marked" (staff), or leave them blank (students: no class attendance taken). */
  flagUnmarked: boolean;
  /** Saturday is a weekly off too (Sunday always is). */
  saturdayOff: boolean;
  /** The chosen month's totals in a line, under the register's title. */
  monthLine?: string;
  /** Columns are the cells' labels, then %. */
  monthRows: AttendanceMonthRow[];
  monthHref: (month: string) => string;
  /** Link to the whole group's register; left out where the viewer can't open it (teacher portal). */
  registerHref?: string;
  registerLabel?: string;
}) {
  const prev = month > minMonth ? addMonths(month, -1) : null;
  const next = month < maxMonth ? addMonths(month, 1) : null;

  // The month as weeks, Monday first; blanks before the 1st.
  const dates = monthDates(month);
  const lead = (parseISODate(dates[0])!.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  const columns = monthRows[0]?.cells.map((c) => c.label) ?? [];

  return (
    <div className="space-y-6">
      <Card title={`Attendance · Session ${session}`} icon={CalendarCheck} description={subtitle}>
        {percent == null ? (
          <p className="text-sm text-muted">No attendance marked yet this session.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className={`text-display-sm font-semibold tabular-nums ${percentTone(percent)}`}>{percent}%</p>
              {aside && <p className="text-xs text-muted">{aside}</p>}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className={cx("h-full rounded-full", percent >= 90 ? "bg-success-solid" : percent >= 75 ? "bg-warning-solid" : "bg-danger-solid")} style={{ width: `${percent}%` }} />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {counts.map((c) => (
                <div key={c.label} className="rounded-lg bg-surface-2 py-2">
                  <dt className="text-[11px] font-medium text-muted">{c.label}</dt>
                  <dd className={`text-base font-semibold tabular-nums ${c.cls ?? "text-fg"}`}>{num(c.value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">{note}</p>
          </>
        )}
      </Card>

      <Card
        title={`Monthly register · ${monthName.format(parseISODate(`${month}-01`)!)}`}
        icon={TableProperties}
        description={monthLine}
        action={
          <span className="flex items-center gap-1.5">
            <Link href={prev ? monthHref(prev) : "#"} aria-disabled={!prev} aria-label="Previous month" className={arrow} scroll={false}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={next ? monthHref(next) : "#"} aria-disabled={!next} aria-label="Next month" className={arrow} scroll={false}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </span>
        }
      >
        <div className="grid grid-cols-7 gap-1 text-center sm:gap-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const holiday = holidays.get(d);
            // A mark on a weekly off or holiday isn't counted, so the day shows as off.
            const weekly = isWeeklyOff(d, saturdayOff);
            const mark = holiday || weekly ? undefined : marks[d];
            const future = d > today;
            const leave = !mark && onLeave.has(d);
            // Before tracking began (admission / joining, or the first marks), a day is just a date.
            const quiet = weekly || future || d < since || (!flagUnmarked && !mark);
            const title = mark ? meta[mark].label : leave ? "On approved leave" : holiday ? `Holiday: ${holiday}` : weekly ? "Weekly off" : quiet ? "" : "Not marked";
            const remark = remarks[d];
            return (
              <div
                key={d}
                title={remark ? `${title} · ${remark}` : title}
                className={cx(
                  "flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg text-xs sm:aspect-auto sm:h-14",
                  mark ? meta[mark].on : leave ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200" : holiday || weekly ? "bg-surface-3 text-muted" : quiet ? "text-subtle" : "border border-dashed border-line-strong text-muted",
                  d === today && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
                )}
              >
                <span className="font-semibold tabular-nums">{Number(d.slice(8))}</span>
                <span className="text-[10px] font-medium leading-tight">{mark ? meta[mark].short : leave ? "LV" : holiday ? (holiday.includes("weekly off") ? "Off" : "Hol") : weekly ? "Off" : quiet ? "" : "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          {statuses.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cx("inline-block h-3 w-3 rounded", meta[s].bar)} /> {meta[s].short} {meta[s].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-surface-3" /> Holiday / weekly off
          </span>
          {flagUnmarked && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-dashed border-line-strong" /> Not marked
            </span>
          )}
          {registerHref && (
            <Link href={registerHref} className="ml-auto font-medium text-accent-text hover:underline">
              {registerLabel}
            </Link>
          )}
        </div>
      </Card>

      <Card title="Month by month" padded={false}>
        {monthRows.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted">No attendance marked yet this session.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Month</th>
                  {columns.map((c) => (
                    <th key={c} className={`${thClass} text-right`}>
                      {c}
                    </th>
                  ))}
                  <th className={`${thClass} text-right`}>%</th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {[...monthRows].reverse().map((m) => (
                  <tr key={m.month} className={m.month === month ? "bg-accent-soft/40" : undefined}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <Link href={monthHref(m.month)} scroll={false} className="font-medium text-fg hover:text-accent-text">
                        {shortMonth.format(parseISODate(`${m.month}-01`)!)}
                      </Link>
                    </td>
                    {m.cells.map((c) => (
                      <td key={c.label} className={`${tdClass} text-right tabular-nums ${c.cls ?? ""}`}>
                        {num(c.value)}
                      </td>
                    ))}
                    <td className={`${tdClass} text-right font-semibold tabular-nums ${percentTone(m.percent)}`}>{m.percent == null ? "—" : `${m.percent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
