"use client";

import { PagedTable } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatISO, isSunday, parseISODate, shortDate } from "@/lib/attendance-shared";
import { STAFF_STATUSES, STAFF_STATUS_META, type StaffGroup, type StaffStatusKey } from "@/lib/staff-attendance-shared";
import { MarkEditor } from "./mark-editor";

const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "narrow", timeZone: "UTC" });

export type StaffGridRow = {
  id: string;
  name: string;
  code: string;
  department: string;
  marks: Record<string, StaffStatusKey>;
  leaveDays: string[];
  present: number;
  absent: number;
  leave: number;
  lop: number;
  percent: number | null;
};

const OPTIONS = STAFF_STATUSES.map((s) => ({ value: s, label: STAFF_STATUS_META[s].label, short: STAFF_STATUS_META[s].short, on: STAFF_STATUS_META[s].on }));

function pctTone(p: number | null) {
  if (p == null) return "text-subtle";
  return p >= 90 ? "text-success" : p >= 75 ? "text-warning" : "text-danger";
}

const num = (n: number) => (n % 1 ? n.toFixed(1) : String(n));

/**
 * Month grid for staff: one row per person, one column per day (P, A, L, HD,
 * LV, H for holidays and weekly offs), then Present, Absent, Leave, LOP and %.
 * With `edit`, clicking a day opens the editor (a reason is required).
 */
export function StaffRegisterGrid({
  group,
  dates,
  today,
  holidays,
  rows,
  edit,
}: {
  group: StaffGroup;
  dates: string[];
  today: string;
  holidays: Record<string, string>;
  rows: StaffGridRow[];
  edit?: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const cell = "h-8 min-w-7 border-b border-l border-line px-0.5 text-center text-[11px]";
  const sum = "border-b border-l border-line px-2 text-center text-xs tabular-nums";
  return (
    <PagedTable
      noun="people"
      pageSize={30}
      tableClassName="min-w-full border-separate border-spacing-0 text-sm"
      theadClassName="bg-surface-2"
      head={
        <tr>
          <th className="sticky left-0 z-10 min-w-52 border-b border-line bg-surface-2 px-4 py-2 text-left text-eyebrow uppercase text-muted">Name</th>
          {dates.map((d) => {
            const off = holidays[d] ?? (isSunday(d) ? "Sunday" : undefined);
            return (
              <th key={d} title={off} className={`${cell} py-1 font-semibold text-fg-2 ${off ? "bg-surface-3 text-subtle" : ""}`}>
                <span className="block text-[10px] font-normal text-subtle">{weekday.format(parseISODate(d)!)}</span>
                {Number(d.slice(8))}
              </th>
            );
          })}
          <th title="Present days (late counts as present, half day as half)" className={`${sum} font-semibold text-success`}>
            Present
          </th>
          <th className={`${sum} font-semibold text-danger`}>Absent</th>
          <th title="Approved leave" className={`${sum} font-semibold text-violet-700 dark:text-violet-300`}>
            Leave
          </th>
          <th title="Loss of pay: absent days plus half of each half day" className={`${sum} font-semibold text-warning`}>
            LOP
          </th>
          <th className={`${sum} font-semibold text-muted`}>%</th>
        </tr>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-surface-2">
          <td className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-1.5">
            <span className="block truncate text-sm text-fg">{r.name}</span>
            <span className="block truncate text-[11px] text-subtle">
              {r.code}
              {r.department ? ` · ${r.department}` : ""}
            </span>
          </td>
          {dates.map((d) => {
            const off = holidays[d] ?? (isSunday(d) ? "Sunday" : undefined);
            const status = r.marks[d];
            const leave = !status && r.leaveDays.includes(d);
            const label = status ? STAFF_STATUS_META[status].short : leave ? "LV" : off ? "H" : "";
            const tone = status ? STAFF_STATUS_META[status].text : leave ? STAFF_STATUS_META.ON_LEAVE.text : "text-subtle";
            const content = <span className={`font-semibold ${tone}`}>{label}</span>;
            return (
              <td key={d} className={`${cell} ${off && !status ? "bg-surface-3" : ""} ${status === "ABSENT" ? "bg-danger-soft" : ""}`}>
                {edit && d <= today ? (
                  <MarkEditor
                    options={OPTIONS}
                    current={status ?? null}
                    title={`${r.name} · ${formatISO(d, shortDate)}${off ? ` (${off})` : ""}`}
                    fields={{ group, personId: r.id, date: d }}
                    action={edit}
                    className="min-h-7"
                  >
                    {content}
                  </MarkEditor>
                ) : (
                  content
                )}
              </td>
            );
          })}
          <td className={`${sum} font-semibold text-fg`}>{num(r.present)}</td>
          <td className={`${sum} text-fg-2`}>{r.absent || ""}</td>
          <td className={`${sum} text-fg-2`}>{r.leave || ""}</td>
          <td className={`${sum} font-semibold ${r.lop ? "text-warning" : "text-subtle"}`}>{r.lop ? num(r.lop) : "0"}</td>
          <td className={`${sum} font-semibold ${pctTone(r.percent)}`}>{r.percent == null ? "—" : `${num(r.percent)}%`}</td>
        </tr>
      ))}
    </PagedTable>
  );
}

export function StaffRegisterLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {STAFF_STATUSES.map((s) => (
        <span key={s}>
          <strong className={STAFF_STATUS_META[s].text}>{STAFF_STATUS_META[s].short}</strong> {STAFF_STATUS_META[s].label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-surface-3" /> <strong>H</strong> Holiday / weekly off
      </span>
      <span>LOP = absent days + half of each half day. Approved leave isn&apos;t counted in the %.</span>
    </div>
  );
}
