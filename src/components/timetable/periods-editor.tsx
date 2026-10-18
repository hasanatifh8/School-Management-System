"use client";

import { useState } from "react";
import { Coffee, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { DAY_NAMES } from "@/lib/timetable-shared";

type Kind = "period" | "break" | "assembly";
type Period = { id: string; name: string; startTime: string; endTime: string; isBreak: boolean; isAssembly: boolean };
type Row = { key: string; id: string; name: string; startTime: string; endTime: string; kind: Kind };

const MINUTES: Record<Kind, number> = { period: 40, break: 20, assembly: 15 };
const KIND_LABEL: Record<Kind, string> = { period: "Period", break: "Break", assembly: "Assembly" };

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

/** Default names ("Period 3", "Break", "Assembly") follow the row's kind and order; typed names are kept. */
const DEFAULT_NAME = /^(Period \d+|Break|Assembly)$/;
function renumber(rows: Row[]) {
  let n = 0;
  return rows.map((r) => {
    if (r.kind === "period") n++;
    if (!DEFAULT_NAME.test(r.name)) return r;
    const name = r.kind === "period" ? `Period ${n}` : KIND_LABEL[r.kind];
    return name === r.name ? r : { ...r, name };
  });
}

/**
 * The school's periods and school days. New rows start where the last one ends;
 * changing a row's type (or its times) moves every later row along with it.
 * An assembly goes at the start of the day and pushes the periods after it.
 */
export function PeriodsEditor({
  periods,
  days,
  action,
}: {
  periods: Period[];
  days: number[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    periods.map((p) => ({
      key: p.id,
      id: p.id,
      name: p.name,
      startTime: p.startTime,
      endTime: p.endTime,
      kind: p.isAssembly ? "assembly" : p.isBreak ? "break" : "period",
    })),
  );
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

  // A row given a new type takes that type's default length; later rows move to match.
  const setKind = (key: string, kind: Kind) =>
    edit(key, (r, i, all) => {
      const endTime = addMinutes(r.startTime, MINUTES[kind]);
      return renumber(shiftAfter(replace(all, i, { ...r, kind, endTime }), i, toMinutes(endTime) - toMinutes(r.endTime)));
    });

  const hasAssembly = rows.some((r) => r.kind === "assembly");

  // The assembly starts when the day starts; every row after it moves later by its length.
  function addAssembly() {
    setRows((prev) => {
      const start = prev[0]?.startTime ?? "08:00";
      const assembly: Row = { key: crypto.randomUUID(), id: "", name: "Assembly", startTime: start, endTime: addMinutes(start, MINUTES.assembly), kind: "assembly" };
      return renumber(shiftAfter([assembly, ...prev], 0, MINUTES.assembly));
    });
  }

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
          endTime: addMinutes(start, MINUTES[addBreak ? "break" : "period"]),
          kind: addBreak ? "break" : "period",
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
        <p className="mb-2 text-sm font-medium text-fg-2">Assembly, periods and breaks, in order</p>
        {rows.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">
            No periods. Add the first one below, or save to keep the school day empty.
          </p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={r.key}
                className={`grid items-center gap-2 rounded-xl border p-2.5 sm:grid-cols-[2rem_1fr_7.5rem_7.5rem_7.5rem_auto] ${
                  r.kind === "assembly"
                    ? "border-dashed border-accent-line bg-accent-soft"
                    : r.kind === "break"
                      ? "border-dashed border-line bg-surface-2"
                      : "border-line"
                }`}
              >
                <span className="hidden text-center text-xs font-semibold text-subtle tabular-nums sm:block">
                  {r.kind === "assembly" ? (
                    <Megaphone className="mx-auto h-4 w-4" aria-label="Assembly" />
                  ) : r.kind === "break" ? (
                    <Coffee className="mx-auto h-4 w-4" aria-label="Break" />
                  ) : (
                    i + 1
                  )}
                </span>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="kind" value={r.kind} />
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
                <select value={r.kind} onChange={(e) => setKind(r.key, e.target.value as Kind)} aria-label="Type" className={selectClass}>
                  <option value="period">Period</option>
                  <option value="break">Break</option>
                  {(r.kind === "assembly" || !hasAssembly) && <option value="assembly">Assembly</option>}
                </select>
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
            Break ({MINUTES.break} min)
          </label>
          {!hasAssembly && (
            <button type="button" onClick={addAssembly} className={buttonVariants.secondary}>
              <Megaphone className="h-4 w-4" /> Add assembly ({MINUTES.assembly} min)
            </button>
          )}
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
