"use client";

import { useState } from "react";
import { Coffee, Plus, Save, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { DAY_NAMES } from "@/lib/timetable-shared";

type Row = { key: string; id: string; name: string; startTime: string; endTime: string; isBreak: boolean };

const PERIOD_MINUTES = 40;
const BREAK_MINUTES = 20;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (mins: number) => {
  const total = Math.max(0, Math.min(23 * 60 + 59, mins));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const addMinutes = (t: string, mins: number) => toTime(toMinutes(t) + mins);

/** Rows after `index` move by `delta` minutes, keeping their lengths. */
const shiftAfter = (rows: Row[], index: number, delta: number) =>
  delta === 0 ? rows : rows.map((r, i) => (i > index ? { ...r, startTime: addMinutes(r.startTime, delta), endTime: addMinutes(r.endTime, delta) } : r));

/** Default names ("Period 3", "Break") follow the row's kind and order; typed names are kept. */
const DEFAULT_NAME = /^(Period \d+|Break)$/;
function renumber(rows: Row[]) {
  let n = 0;
  return rows.map((r) => {
    if (!r.isBreak) n++;
    if (!DEFAULT_NAME.test(r.name)) return r;
    const name = r.isBreak ? "Break" : `Period ${n}`;
    return name === r.name ? r : { ...r, name };
  });
}

/**
 * The school's periods and school days. New rows start where the last one ends;
 * ticking "Break" on a row (or changing its times) moves every later row along with it.
 */
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
  const [addBreak, setAddBreak] = useState(false);
  const edit = (key: string, change: (r: Row, i: number, all: Row[]) => Row[]) =>
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key);
      return i < 0 ? prev : change(prev[i], i, prev);
    });

  const replace = (all: Row[], i: number, row: Row) => all.map((r, j) => (j === i ? row : r));

  // A new end time moves the rows after it by the same amount.
  const setEnd = (key: string, endTime: string) =>
    edit(key, (r, i, all) => shiftAfter(replace(all, i, { ...r, endTime }), i, toMinutes(endTime) - toMinutes(r.endTime)));

  // A new start time moves the whole row (keeping its length) and the rows after it.
  const setStart = (key: string, startTime: string) =>
    edit(key, (r, i, all) => {
      const delta = toMinutes(startTime) - toMinutes(r.startTime);
      return shiftAfter(replace(all, i, { ...r, startTime, endTime: addMinutes(r.endTime, delta) }), i, delta);
    });

  // A row turned into a break (or back) takes the default length; later rows move to match.
  const setBreak = (key: string, isBreak: boolean) =>
    edit(key, (r, i, all) => {
      const endTime = addMinutes(r.startTime, isBreak ? BREAK_MINUTES : PERIOD_MINUTES);
      return renumber(shiftAfter(replace(all, i, { ...r, isBreak, endTime }), i, toMinutes(endTime) - toMinutes(r.endTime)));
    });

  const remove = (key: string) => setRows((prev) => renumber(prev.filter((r) => r.key !== key)));

  function add() {
    setRows((prev) => {
      const start = prev.at(-1)?.endTime ?? "08:00";
      return renumber([
        ...prev,
        {
          key: crypto.randomUUID(),
          id: "",
          name: addBreak ? "Break" : "Period 1",
          startTime: start,
          endTime: addMinutes(start, addBreak ? BREAK_MINUTES : PERIOD_MINUTES),
          isBreak: addBreak,
        },
      ]);
    });
    setAddBreak(false);
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
          <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">
            No periods. Add the first one below, or save to keep the school day empty.
          </p>
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
                  onChange={(e) => edit(r.key, (row, i, all) => replace(all, i, { ...row, name: e.target.value }))}
                  aria-label="Name"
                  className={inputClass}
                />
                <input
                  type="time"
                  name="startTime"
                  required
                  value={r.startTime}
                  onChange={(e) => e.target.value && setStart(r.key, e.target.value)}
                  aria-label="Starts"
                  className={inputClass}
                />
                <input
                  type="time"
                  name="endTime"
                  required
                  value={r.endTime}
                  onChange={(e) => e.target.value && setEnd(r.key, e.target.value)}
                  aria-label="Ends"
                  className={inputClass}
                />
                <label className="flex items-center gap-1.5 px-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={r.isBreak}
                    onChange={(e) => setBreak(r.key, e.target.checked)}
                    className={checkboxClass}
                  />
                  Break
                </label>
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  className={`${buttonVariants.dangerGhost} !p-2`}
                  aria-label={`Remove ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={add} className={buttonVariants.secondary}>
            {addBreak ? <Coffee className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {addBreak ? "Add break" : "Add period"}
          </button>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" checked={addBreak} onChange={(e) => setAddBreak(e.target.checked)} className={checkboxClass} />
            Break ({BREAK_MINUTES} min)
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <p className="mr-auto text-xs text-muted">
          Removed rows disappear now and are deleted when you save. Removing a period or a school day also clears it from every class timetable.
        </p>
        <SubmitButton
          icon={<Save className="h-4 w-4" />}
          confirm={!periods.length ? undefined : rows.length ? "Save the bell schedule for every class?" : "Clear the bell schedule? Every class timetable will be emptied."}
        >
          Save bell schedule
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
