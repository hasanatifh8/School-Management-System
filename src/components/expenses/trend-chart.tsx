import { TriangleAlert } from "lucide-react";
import { rupees } from "@/lib/fees-shared";
import { MONTH_NAMES } from "@/lib/fees-shared";

const label = (m: string) => `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;

/**
 * Total spent per month (one series, so no legend) with the monthly budget as a
 * dashed reference line. Hover a bar for exact figures; over-budget months get
 * an icon + label, not just colour. A screen-reader table carries the numbers.
 */
export function TrendChart({ data, selected }: { data: { month: string; spent: number; budget: number | null }[]; selected: string }) {
  const max = Math.max(1, ...data.map((d) => d.spent), ...data.map((d) => d.budget ?? 0)) * 1.12;
  const budget = data.at(-1)?.budget ?? null;
  return (
    <figure>
      <div className="relative h-52 border-b border-slate-200 pt-6">
        {budget != null && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-slate-400" style={{ bottom: `${(budget / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 rounded bg-white px-1 text-[11px] font-medium text-slate-500">Budget {rupees(budget)}</span>
          </div>
        )}
        <div className="flex h-full items-end gap-[2px]">
          {data.map((d) => {
            const over = d.budget != null && d.spent > d.budget;
            const isSelected = d.month === selected;
            return (
              <div key={d.month} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                {(isSelected || over) && d.spent > 0 && (
                  <span className="mb-1 flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium text-slate-700">
                    {over && <TriangleAlert className="h-3 w-3 text-rose-500" aria-label="Over budget" />}
                    {isSelected ? rupees(d.spent) : "Over"}
                  </span>
                )}
                <div
                  className={`w-full max-w-14 rounded-t-[4px] transition ${isSelected ? "bg-indigo-600" : "bg-indigo-300 group-hover:bg-indigo-400"}`}
                  style={{ height: `${(d.spent / max) * 100}%`, minHeight: d.spent ? 2 : 0 }}
                />
                <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                  <p className="font-semibold">{label(d.month)}</p>
                  <p>Spent {rupees(d.spent)}</p>
                  {d.budget != null && <p className="text-slate-300">{over ? `${rupees(d.spent - d.budget)} over budget` : `${rupees(d.budget - d.spent)} under budget`}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] text-center text-[11px] text-slate-500">
        {data.map((d) => (
          <span key={d.month} className={`flex-1 ${d.month === selected ? "font-semibold text-slate-900" : ""}`}>
            {label(d.month)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Spending by month</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th>{label(d.month)}</th>
              <td>{rupees(d.spent)}</td>
              <td>{d.budget != null ? `Budget ${rupees(d.budget)}` : "No budget"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
