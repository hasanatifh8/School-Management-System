import { Coffee } from "lucide-react";
import { DAY_SHORT, periodTime, slotKey, type PeriodInfo } from "@/lib/timetable-shared";

export type Cell = { title: string; sub?: string };

/** A read-only week: periods down the side, days across. Scrolls sideways on phones. */
export function TimetableGrid({
  days,
  periods,
  cells,
  today,
}: {
  days: number[];
  periods: PeriodInfo[];
  cells: Record<string, Cell>;
  /** 1 = Monday … 7 = Sunday; highlights that column. */
  today?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-32 px-2 py-2 text-left text-eyebrow uppercase text-muted">Period</th>
            {days.map((d) => (
              <th
                key={d}
                className={`rounded-lg px-2 py-2 text-center text-eyebrow uppercase ${d === today ? "bg-accent-soft text-accent-text" : "text-muted"}`}
              >
                {DAY_SHORT[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) =>
            p.isBreak ? (
              <tr key={p.id}>
                <td className="px-2 py-1.5 align-middle">
                  <PeriodName period={p} />
                </td>
                <td colSpan={days.length} className="rounded-lg bg-surface-2 px-3 py-1.5 text-center text-xs font-medium text-muted">
                  <Coffee className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                  {p.name}
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td className="px-2 py-1.5 align-middle">
                  <PeriodName period={p} />
                </td>
                {days.map((d) => {
                  const c = cells[slotKey(d, p.id)];
                  return (
                    <td
                      key={d}
                      className={`h-14 rounded-lg px-2 py-1.5 text-center align-middle ${
                        c ? "bg-accent-soft/60 ring-1 ring-inset ring-accent-line/60" : "bg-surface-2/60"
                      } ${d === today ? "ring-2 ring-accent/40" : ""}`}
                    >
                      {c ? (
                        <>
                          <span className="block truncate font-medium text-fg">{c.title}</span>
                          {c.sub && <span className="block truncate text-[11px] text-muted">{c.sub}</span>}
                        </>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PeriodName({ period }: { period: PeriodInfo }) {
  return (
    <>
      <span className="block text-xs font-semibold text-fg">{period.name}</span>
      <span className="block whitespace-nowrap text-[11px] text-muted">{periodTime(period)}</span>
    </>
  );
}
