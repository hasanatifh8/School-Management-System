import Link from "next/link";
import { ATTENDANCE_STATUSES, STATUS_META, isSunday, parseISODate } from "@/lib/attendance-shared";
import type { Register } from "@/lib/attendance";

const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "narrow", timeZone: "UTC" });

function pct(p: number | null) {
  return p == null ? "—" : `${p % 1 ? p.toFixed(1) : p}%`;
}

function pctTone(p: number | null) {
  if (p == null) return "text-slate-400";
  return p >= 90 ? "text-emerald-700" : p >= 75 ? "text-amber-700" : "text-rose-700";
}

/** Month grid: one row per student, one column per day, with totals. */
export function RegisterGrid({ register, today, dayHref }: { register: Register; today: string; dayHref?: (date: string) => string }) {
  const { dates, students, classHolidays, schoolHolidays, daily } = register;
  const cellBase = "h-8 min-w-7 border-l border-slate-100 px-0.5 text-center text-[11px]";
  return (
    <div className="relative overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="sticky left-0 z-10 min-w-48 border-b border-slate-100 bg-slate-50 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Student
            </th>
            <th title="Attendance this month" className={`${cellBase} border-b px-2 text-[11px] font-semibold uppercase text-slate-500`}>Month</th>
            <th title="Attendance this session" className={`${cellBase} border-b border-r px-2 text-[11px] font-semibold uppercase text-slate-500`}>Session</th>
            {dates.map((d) => {
              const holiday = schoolHolidays.get(d)?.name ?? classHolidays.get(d);
              const day = Number(d.slice(8));
              const label = (
                <>
                  <span className="block text-[10px] font-normal text-slate-400">{weekday.format(parseISODate(d)!)}</span>
                  {day}
                </>
              );
              return (
                <th
                  key={d}
                  title={holiday ?? (isSunday(d) ? "Sunday" : undefined)}
                  className={`${cellBase} border-b py-1 font-semibold text-slate-600 ${holiday ? "bg-violet-50 text-violet-700" : isSunday(d) ? "bg-slate-100 text-slate-400" : ""}`}
                >
                  {dayHref && d <= today ? (
                    <Link href={dayHref(d)} className="block hover:text-indigo-600">
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
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/70">
              <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-1.5">
                <span className="mr-2 inline-block w-5 text-right font-mono text-[11px] text-slate-400">{s.rollNumber ?? ""}</span>
                <span className={`text-sm ${s.moved ? "text-slate-400" : "text-slate-800"}`}>{s.name}</span>
                {s.moved && <span className="ml-1 text-[10px] text-slate-400">(left class)</span>}
              </td>
              <td className={`${cellBase} border-b px-2 font-semibold tabular-nums ${pctTone(s.monthPercent)}`}>{pct(s.monthPercent)}</td>
              <td className={`${cellBase} border-b border-r px-2 font-semibold tabular-nums ${pctTone(s.sessionPercent)}`}>{pct(s.sessionPercent)}</td>
              {dates.map((d) => {
                const holiday = schoolHolidays.has(d) || classHolidays.has(d);
                const status = holiday ? undefined : s.marks.get(d);
                return (
                  <td
                    key={d}
                    className={`${cellBase} border-b font-semibold ${
                      holiday ? "bg-violet-100/60" : isSunday(d) && !status ? "bg-slate-50" : ""
                    } ${status ? STATUS_META[status].text : "text-slate-300"} ${status === "ABSENT" ? "bg-rose-50" : ""}`}
                  >
                    {status ? STATUS_META[status].short : ""}
                  </td>
                );
              })}
              {ATTENDANCE_STATUSES.map((st) => (
                <td key={st} className={`${cellBase} border-b tabular-nums text-slate-600`}>
                  {s.month[st] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50/80">
            <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">Attending</td>
            <td colSpan={2} className="border-r border-slate-100" />
            {dates.map((d) => (
              <td key={d} className={`${cellBase} font-medium tabular-nums text-slate-600`}>
                {daily.get(d) ?? ""}
              </td>
            ))}
            <td colSpan={ATTENDANCE_STATUSES.length} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function RegisterLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      {ATTENDANCE_STATUSES.map((s) => (
        <span key={s}>
          <strong className={STATUS_META[s].text}>{STATUS_META[s].short}</strong> {STATUS_META[s].label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-violet-100" /> Holiday
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-slate-100" /> Sunday
      </span>
      <span>Late counts as present, half day as half.</span>
    </div>
  );
}
