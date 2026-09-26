import Link from "next/link";
import { PagedTable } from "@/components/ui";
import { ATTENDANCE_STATUSES, STATUS_META, isSunday, parseISODate } from "@/lib/attendance-shared";
import type { Register } from "@/lib/attendance";

const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "narrow", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });
const shortMonthYear = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Students per page in the register (a normal class fits on one page). */
const PAGE_SIZE = 30;

function pct(p: number | null) {
  return p == null ? "—" : `${p % 1 ? p.toFixed(1) : p}%`;
}

function pctTone(p: number | null) {
  if (p == null) return "text-subtle";
  return p >= 90 ? "text-success" : p >= 75 ? "text-warning" : "text-danger";
}

function barTone(p: number | null) {
  if (p == null) return "bg-line-strong";
  return p >= 90 ? "bg-success-solid" : p >= 75 ? "bg-warning-solid" : "bg-danger-solid";
}

const headCell = "border-b border-line px-2 py-2 text-center text-[11px] font-semibold uppercase text-muted";
const stickyHead = "sticky left-0 z-10 min-w-48 border-b border-line bg-surface-2 px-4 py-2 text-left text-eyebrow uppercase text-muted";
const stickyCell = "sticky left-0 z-10 border-b border-line bg-surface px-4 py-1.5";

function StudentCell({ s }: { s: Register["students"][number] }) {
  return (
    <td className={stickyCell}>
      <span className="mr-2 inline-block w-5 text-right font-mono text-[11px] text-subtle">{s.rollNumber ?? ""}</span>
      <span className={`text-sm ${s.moved ? "text-subtle" : "text-fg"}`}>{s.name}</span>
      {s.moved && <span className="ml-1 text-[10px] text-subtle">(left class)</span>}
    </td>
  );
}

/** Day-by-day grid: one row per student, one column per day, with totals. */
export function RegisterGrid({
  register,
  today,
  dayHref,
  periodLabel = "Period",
}: {
  register: Register;
  today: string;
  dayHref?: (date: string) => string;
  /** Header for the range percentage column, e.g. "Week". */
  periodLabel?: string;
}) {
  const { dates, months, students, classHolidays, schoolHolidays, daily } = register;
  const cellBase = "h-8 min-w-7 border-l border-line px-0.5 text-center text-[11px]";
  const manyMonths = months.length > 1;
  return (
    <PagedTable
      noun="students"
      pageSize={PAGE_SIZE}
      tableClassName="min-w-full border-separate border-spacing-0 text-sm"
      theadClassName="bg-surface-2"
      head={
        <tr>
          <th className={stickyHead}>Student</th>
          <th title={`Attendance for this ${periodLabel.toLowerCase()}`} className={`${cellBase} border-b px-2 text-[11px] font-semibold uppercase text-muted`}>
            {periodLabel}
          </th>
          <th title="Attendance this session" className={`${cellBase} border-b border-r px-2 text-[11px] font-semibold uppercase text-muted`}>
            Session
          </th>
          {dates.map((d, i) => {
            const holiday = schoolHolidays.get(d)?.name ?? classHolidays.get(d);
            const day = Number(d.slice(8));
            const label = (
              <>
                <span className="block text-[10px] font-normal text-subtle">
                  {manyMonths && (i === 0 || day === 1) ? shortMonth.format(parseISODate(d)!) : weekday.format(parseISODate(d)!)}
                </span>
                {day}
              </>
            );
            return (
              <th
                key={d}
                title={holiday ?? (isSunday(d) ? "Sunday" : undefined)}
                className={`${cellBase} border-b py-1 font-semibold text-fg-2 ${holiday ? "bg-accent-soft text-accent-text" : isSunday(d) ? "bg-surface-3 text-subtle" : ""} ${manyMonths && day === 1 && i > 0 ? "border-l-2 border-l-line-strong" : ""}`}
              >
                {dayHref && d <= today ? (
                  <Link href={dayHref(d)} className="block rounded transition hover:text-accent-text">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </th>
            );
          })}
          {ATTENDANCE_STATUSES.map((s) => (
            <th key={s} title={STATUS_META[s].label} className={`${cellBase} border-b px-2 font-semibold ${STATUS_META[s].text}`}>
              {STATUS_META[s].short}
            </th>
          ))}
        </tr>
      }
      foot={
        <tr className="bg-surface-2">
          <td className="sticky left-0 z-10 bg-surface-2 px-4 py-2 text-xs font-medium text-muted">Attending</td>
          <td colSpan={2} className="border-r border-line" />
          {dates.map((d) => (
            <td key={d} className={`${cellBase} font-medium tabular-nums text-fg-2`}>
              {daily.get(d) ?? ""}
            </td>
          ))}
          <td colSpan={ATTENDANCE_STATUSES.length} />
        </tr>
      }
    >
      {students.map((s) => (
        <tr key={s.id} className="hover:bg-surface-2">
          <StudentCell s={s} />
          <td className={`${cellBase} border-b px-2 font-semibold tabular-nums ${pctTone(s.periodPercent)}`}>{pct(s.periodPercent)}</td>
          <td className={`${cellBase} border-b border-r px-2 font-semibold tabular-nums ${pctTone(s.sessionPercent)}`}>{pct(s.sessionPercent)}</td>
          {dates.map((d, i) => {
            const holiday = schoolHolidays.has(d) || classHolidays.has(d);
            const status = holiday ? undefined : s.marks.get(d);
            return (
              <td
                key={d}
                className={`${cellBase} border-b font-semibold ${holiday ? "bg-accent-soft" : isSunday(d) && !status ? "bg-surface-2" : ""} ${
                  status ? STATUS_META[status].text : "text-subtle"
                } ${status === "ABSENT" ? "bg-danger-soft" : ""} ${manyMonths && d.endsWith("-01") && i > 0 ? "border-l-2 border-l-line-strong" : ""}`}
              >
                {status ? STATUS_META[status].short : ""}
              </td>
            );
          })}
          {ATTENDANCE_STATUSES.map((st) => (
            <td key={st} className={`${cellBase} border-b tabular-nums text-fg-2`}>
              {s.period[st] || ""}
            </td>
          ))}
        </tr>
      ))}
    </PagedTable>
  );
}

/**
 * Totals per student for a long range (a session or a custom span): counts
 * per status, a percentage for each month, and for the whole range.
 */
export function RegisterSummary({ register, periodLabel = "Period" }: { register: Register; periodLabel?: string }) {
  const { months, students, workingByMonth } = register;
  const showMonths = months.length > 1;
  return (
    <PagedTable
      noun="students"
      pageSize={PAGE_SIZE}
      tableClassName="min-w-full border-separate border-spacing-0 text-sm"
      theadClassName="bg-surface-2"
      head={
        <tr>
          <th className={stickyHead}>Student</th>
          {ATTENDANCE_STATUSES.map((s) => (
            <th key={s} title={STATUS_META[s].label} className={`${headCell} ${STATUS_META[s].text}`}>
              {STATUS_META[s].short}
            </th>
          ))}
          {showMonths &&
            months.map((m) => (
              <th key={m} title={`${workingByMonth.get(m) ?? 0} working day(s)`} className={`${headCell} normal-case`}>
                {shortMonthYear.format(parseISODate(`${m}-01`)!)}
              </th>
            ))}
          <th className={`${headCell} min-w-40 border-l`}>{periodLabel}</th>
          <th className={headCell}>Session</th>
        </tr>
      }
    >
      {students.map((s) => (
        <tr key={s.id} className="hover:bg-surface-2">
          <StudentCell s={s} />
          {ATTENDANCE_STATUSES.map((st) => (
            <td key={st} className="border-b border-line px-2 text-center text-xs tabular-nums text-fg-2">
              {s.period[st] || <span className="text-subtle">0</span>}
            </td>
          ))}
          {showMonths &&
            months.map((m) => {
              const p = s.monthPercent.get(m) ?? null;
              return (
                <td key={m} className={`border-b border-line px-2 text-center text-xs font-medium tabular-nums ${pctTone(p)}`}>
                  {pct(p)}
                </td>
              );
            })}
          <td className="border-b border-l border-line px-3 py-1.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className={`h-full rounded-full ${barTone(s.periodPercent)}`} style={{ width: `${s.periodPercent ?? 0}%` }} />
              </div>
              <span className={`w-12 text-right text-xs font-semibold tabular-nums ${pctTone(s.periodPercent)}`}>{pct(s.periodPercent)}</span>
            </div>
          </td>
          <td className={`border-b border-line px-2 text-center text-xs font-semibold tabular-nums ${pctTone(s.sessionPercent)}`}>{pct(s.sessionPercent)}</td>
        </tr>
      ))}
    </PagedTable>
  );
}

export function RegisterLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {ATTENDANCE_STATUSES.map((s) => (
        <span key={s}>
          <strong className={STATUS_META[s].text}>{STATUS_META[s].short}</strong> {STATUS_META[s].label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-accent-soft" /> Holiday
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-surface-3" /> Sunday
      </span>
      <span>Late counts as present, half day as half. Green 90%+, amber 75–90%, red below 75%.</span>
    </div>
  );
}
