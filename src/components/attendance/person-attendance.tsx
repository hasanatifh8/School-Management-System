import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, TableProperties } from "lucide-react";
import { Card, cx, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { addMonths, isSunday, monthDates, monthName, parseISODate } from "@/lib/attendance-shared";
import { STAFF_STATUSES, STAFF_STATUS_META } from "@/lib/staff-attendance-shared";
import type { PersonAttendance } from "@/lib/staff-register";

const arrow =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 aria-disabled:pointer-events-none aria-disabled:opacity-40";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const sinceDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const tone = (p: number | null) => (p == null ? "text-subtle" : p >= 90 ? "text-success" : p >= 75 ? "text-warning" : "text-danger");

/**
 * A teacher's (or staff member's) attendance on their profile: the session's
 * totals, the chosen month as a calendar register, and every month's totals.
 */
export function PersonAttendanceView({
  data,
  session,
  month,
  minMonth,
  maxMonth,
  today,
  monthHref,
  registerHref,
}: {
  data: PersonAttendance;
  session: string;
  /** The month shown in the register (YYYY-MM). */
  month: string;
  minMonth: string;
  maxMonth: string;
  today: string;
  monthHref: (month: string) => string;
  /** The whole staff group's register for this month. */
  registerHref: string;
}) {
  const t = data.total;
  const counts = [
    { label: "Present", value: t.present, cls: "text-success" },
    { label: "Absent", value: t.absent, cls: t.absent ? "text-danger" : "text-fg" },
    { label: "Late", value: t.late, cls: "text-fg" },
    { label: "Half day", value: t.halfDay, cls: "text-fg" },
    { label: "Leave", value: t.leave, cls: "text-fg" },
    { label: "Loss of pay", value: t.lop, cls: t.lop ? "text-danger" : "text-fg" },
  ];
  const thisMonth = data.byMonth.find((m) => m.month === month);
  const prev = month > minMonth ? addMonths(month, -1) : null;
  const next = month < maxMonth ? addMonths(month, 1) : null;

  // The month as weeks, Monday first; blanks before the 1st.
  const dates = monthDates(month);
  const lead = (parseISODate(dates[0])!.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="space-y-6">
      <Card
        title={`Attendance · Session ${session}`}
        icon={CalendarCheck}
        description={data.working.length ? `${data.working.length} working day${data.working.length === 1 ? "" : "s"} since ${sinceDate.format(parseISODate(data.since)!)}` : undefined}
      >
        {data.working.length === 0 || t.percent == null ? (
          <p className="text-sm text-muted">No attendance marked yet this session.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className={`text-display-sm font-semibold tabular-nums ${tone(t.percent)}`}>{t.percent}%</p>
              {t.unmarked > 0 && (
                <p className="text-xs text-muted">
                  {t.unmarked} working day{t.unmarked === 1 ? "" : "s"} not marked
                </p>
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className={cx("h-full rounded-full", t.percent == null ? "" : t.percent >= 90 ? "bg-success-solid" : t.percent >= 75 ? "bg-warning-solid" : "bg-danger-solid")} style={{ width: `${t.percent ?? 0}%` }} />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {counts.map((c) => (
                <div key={c.label} className="rounded-lg bg-surface-2 py-2">
                  <dt className="text-[11px] font-medium text-muted">{c.label}</dt>
                  <dd className={`text-base font-semibold tabular-nums ${c.cls}`}>{num(c.value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">Approved leave is not counted against attendance. Loss of pay = absent days plus half of each half day.</p>
          </>
        )}
      </Card>

      <Card
        title={`Monthly register · ${monthName.format(parseISODate(`${month}-01`)!)}`}
        icon={TableProperties}
        description={
          thisMonth
            ? `${thisMonth.workingDays} working day${thisMonth.workingDays === 1 ? "" : "s"} · present ${num(thisMonth.present)} · absent ${thisMonth.absent} · leave ${thisMonth.leave}${thisMonth.percent != null ? ` · ${thisMonth.percent}%` : ""}`
            : undefined
        }
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
            const mark = data.marks[d];
            const holiday = data.holidays.get(d);
            const future = d > today;
            const leave = !mark && data.onLeave.has(d);
            const day = Number(d.slice(8));
            // Before tracking began (joining, or the first staff attendance), a day is just a date.
            const untracked = d < data.since;
            const title = mark ? STAFF_STATUS_META[mark].label : leave ? "On approved leave" : holiday ? `Holiday: ${holiday}` : isSunday(d) ? "Sunday" : future || untracked ? "" : "Not marked";
            const note = data.remarks[d];
            return (
              <div
                key={d}
                title={note ? `${title} · ${note}` : title}
                className={cx(
                  "flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg text-xs sm:aspect-auto sm:h-14",
                  mark ? STAFF_STATUS_META[mark].on : leave ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200" : holiday ? "bg-surface-3 text-muted" : isSunday(d) || future || untracked ? "text-subtle" : "border border-dashed border-line-strong text-muted",
                  d === today && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
                )}
              >
                <span className="font-semibold tabular-nums">{day}</span>
                <span className="text-[10px] font-medium leading-tight">
                  {mark ? STAFF_STATUS_META[mark].short : leave ? "LV" : holiday ? "Hol" : isSunday(d) ? "Sun" : future || untracked ? "" : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          {STAFF_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cx("inline-block h-3 w-3 rounded", STAFF_STATUS_META[s].bar)} /> {STAFF_STATUS_META[s].short} {STAFF_STATUS_META[s].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-surface-3" /> Holiday
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-dashed border-line-strong" /> Not marked
          </span>
          <Link href={registerHref} className="ml-auto font-medium text-accent-text hover:underline">
            Full staff register
          </Link>
        </div>
      </Card>

      <Card title="Month by month" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Month</th>
                <th className={`${thClass} text-right`}>Working days</th>
                <th className={`${thClass} text-right`}>Present</th>
                <th className={`${thClass} text-right`}>Absent</th>
                <th className={`${thClass} text-right`}>Late</th>
                <th className={`${thClass} text-right`}>Half day</th>
                <th className={`${thClass} text-right`}>Leave</th>
                <th className={`${thClass} text-right`}>Loss of pay</th>
                <th className={`${thClass} text-right`}>%</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {data.byMonth
                .filter((m) => m.workingDays > 0)
                .reverse()
                .map((m) => (
                  <tr key={m.month} className={m.month === month ? "bg-accent-soft/40" : undefined}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <Link href={monthHref(m.month)} scroll={false} className="font-medium text-fg hover:text-accent-text">
                        {shortMonth.format(parseISODate(`${m.month}-01`)!)}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{m.workingDays}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{num(m.present)}</td>
                    <td className={`${tdClass} text-right tabular-nums ${m.absent ? "text-danger" : ""}`}>{m.absent}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{m.late}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{m.halfDay}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{m.leave}</td>
                    <td className={`${tdClass} text-right tabular-nums ${m.lop ? "text-danger" : ""}`}>{num(m.lop)}</td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums ${tone(m.percent)}`}>{m.percent == null ? "—" : `${m.percent}%`}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
