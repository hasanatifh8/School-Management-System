"use client";

import { useState } from "react";
import { Coffee, Plus, Save, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { DAY_NAMES } from "@/lib/timetable-shared";

type Row = { key: string; id: string; name: string; startTime: string; endTime: string; isBreak: boolean };

const addMinutes = (t: string, mins: number) => {
  const [h, m] = t.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** The school's periods and school days. New periods start where the last one ends. */
export function PeriodsEditor({
  periods,
  days,
  action,
}: {
  periods: Omit<Row, "key">[];
  days: number[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [rows, setRows] = useState<Row[]>(() => periods.map((p) => ({ ...p, key: p.id })));
  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function add(isBreak: boolean) {
    setRows((prev) => {
      const start = prev.at(-1)?.endTime ?? "08:00";
      const teaching = prev.filter((r) => !r.isBreak).length;
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          id: "",
          name: isBreak ? "Break" : `Period ${teaching + 1}`,
          startTime: start,
          endTime: addMinutes(start, isBreak ? 20 : 40),
          isBreak,
        },
      ];
    });
  }

  return (
    <ActionForm action={action} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-fg-2">School days</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft"
            >
              <input type="checkbox" name="day" value={d} defaultChecked={days.includes(d)} className={checkboxClass} />
              {DAY_NAMES[d]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-medium text-fg-2">Periods and breaks, in order</p>
        {rows.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">No periods yet. Add the first period below.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={r.key}
                className={`grid items-center gap-2 rounded-xl border p-2.5 sm:grid-cols-[2rem_1fr_7.5rem_7.5rem_auto_auto] ${
                  r.isBreak ? "border-dashed border-line bg-surface-2" : "border-line"
                }`}
              >
                <span className="hidden text-center text-xs font-semibold text-subtle tabular-nums sm:block">
                  {r.isBreak ? <Coffee className="mx-auto h-4 w-4" aria-label="Break" /> : i + 1}
                </span>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="isBreak" value={r.isBreak ? "1" : "0"} />
                <input
                  name="name"
                  required
                  maxLength={40}
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  aria-label="Name"
                  className={inputClass}
                />
                <input
                  type="time"
                  name="startTime"
                  required
                  value={r.startTime}
                  onChange={(e) => update(r.key, { startTime: e.target.value })}
                  aria-label="Starts"
                  className={inputClass}
                />
                <input
                  type="time"
                  name="endTime"
                  required
                  value={r.endTime}
                  onChange={(e) => update(r.key, { endTime: e.target.value })}
                  aria-label="Ends"
                  className={inputClass}
                />
                <label className="flex items-center gap-1.5 px-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={r.isBreak}
                    onChange={(e) => update(r.key, { isBreak: e.target.checked })}
                    className={checkboxClass}
                  />
                  Break
                </label>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  className={`${buttonVariants.dangerGhost} !p-2`}
                  aria-label={`Remove ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => add(false)} className={buttonVariants.secondary}>
            <Plus className="h-4 w-4" /> Add period
          </button>
          <button type="button" onClick={() => add(true)} className={buttonVariants.ghost}>
            <Coffee className="h-4 w-4" /> Add break
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <p className="mr-auto text-xs text-muted">Removing a period or a school day also clears it from every class timetable.</p>
        <SubmitButton icon={<Save className="h-4 w-4" />} confirm={periods.length ? "Save the bell schedule for every class?" : undefined}>
          Save bell schedule
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
