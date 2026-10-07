import { monthLabel } from "@/lib/fees-shared";
import { selectClass } from "@/components/ui";

/**
 * Two month pickers, "From" and "To", for when a fee (e.g. transport) is
 * charged. Blank means from the start (`startLabel`) or to the session end.
 */
export function MonthRange({
  months,
  from,
  to,
  names = ["feeFrom", "feeTo"],
  startLabel = "From admission",
  compact = false,
}: {
  /** The session's months, "2026-04" … "2027-03". */
  months: string[];
  from?: string | null;
  to?: string | null;
  names?: [string, string];
  startLabel?: string;
  compact?: boolean;
}) {
  const cls = compact ? `${selectClass} !w-36 !py-1 text-xs` : selectClass;
  return (
    <div className={compact ? "flex flex-wrap items-center gap-2 text-xs text-muted" : "grid grid-cols-2 gap-3"}>
      <label className={compact ? "flex items-center gap-1.5" : "text-sm text-fg-2"}>
        From
        <select name={names[0]} defaultValue={from ?? ""} className={compact ? cls : `${cls} mt-1`}>
          <option value="">{startLabel}</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <label className={compact ? "flex items-center gap-1.5" : "text-sm text-fg-2"}>
        To
        <select name={names[1]} defaultValue={to ?? ""} className={compact ? cls : `${cls} mt-1`}>
          <option value="">End of session</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
