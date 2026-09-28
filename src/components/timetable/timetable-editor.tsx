"use client";

import { useEffect, useRef, useState } from "react";
import { Coffee, Copy, Eraser, Save, TriangleAlert } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonVariants } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { DAY_SHORT, SLOT_LABELS, slotKey, type PeriodInfo } from "@/lib/timetable-shared";
import { PeriodName } from "./timetable-grid";

type Slot = { subject: string; teacher: string };

/**
 * The weekly grid for one section. Choosing a subject fills in the teacher
 * assigned to it; a teacher already busy elsewhere in that period is flagged.
 */
export function TimetableEditor({
  days,
  periods,
  subjects,
  teachers,
  subjectTeacher,
  busy,
  initial,
  action,
}: {
  days: number[];
  periods: PeriodInfo[];
  subjects: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  /** subjectId → the teacher assigned to it in this section */
  subjectTeacher: Record<string, string>;
  /** `${teacherId}:${day}:${periodId}` → the other class they teach then */
  busy: Record<string, string>;
  initial: Record<string, Slot>;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [slots, setSlots] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);

  // The form resets after a save; put the chosen values back in the selects.
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onReset = () => setTimeout(() => setSlots((prev) => ({ ...prev })));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);
  const teaching = periods.filter((p) => !p.isBreak);
  const set = (key: string, slot: Slot) => setSlots((prev) => ({ ...prev, [key]: slot }));
  const clashes = Object.entries(slots).filter(([key, s]) => s.teacher && busy[`${s.teacher}:${key}`]).length;
  const filled = Object.values(slots).filter((s) => s.subject).length;

  function copyFirstDay() {
    const first = days[0];
    setSlots((prev) => {
      const next = { ...prev };
      for (const d of days.slice(1)) for (const p of teaching) next[slotKey(d, p.id)] = prev[slotKey(first, p.id)] ?? { subject: "", teacher: "" };
      return next;
    });
  }

  return (
    <ActionForm action={action} className="space-y-4">
      <div ref={ref} className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm text-muted">
          <span className="font-semibold text-fg tabular-nums">{filled}</span> of {teaching.length * days.length} periods filled
          {clashes > 0 && (
            <span className="ml-3 inline-flex items-center gap-1 font-medium text-danger">
              <TriangleAlert className="h-4 w-4" aria-hidden /> {clashes} teacher clash(es)
            </span>
          )}
        </span>
        <button type="button" onClick={copyFirstDay} className={`${buttonVariants.ghost} !px-2.5 !py-1.5 text-xs`}>
          <Copy className="h-3.5 w-3.5" /> Copy {DAY_SHORT[days[0]]} to all days
        </button>
        <button type="button" onClick={() => setSlots({})} className={`${buttonVariants.ghost} !px-2.5 !py-1.5 text-xs`}>
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-32 px-2 py-2 text-left text-eyebrow uppercase text-muted">Period</th>
              {days.map((d) => (
                <th key={d} className="px-2 py-2 text-center text-eyebrow uppercase text-muted">
                  {DAY_SHORT[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) =>
              p.isBreak ? (
                <tr key={p.id}>
                  <td className="px-2 py-1.5">
                    <PeriodName period={p} />
                  </td>
                  <td colSpan={days.length} className="rounded-lg bg-surface-2 px-3 py-1.5 text-center text-xs font-medium text-muted">
                    <Coffee className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                    {p.name}
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td className="px-2 py-1.5 align-top">
                    <PeriodName period={p} />
                  </td>
                  {days.map((d) => {
                    const key = slotKey(d, p.id);
                    const s = slots[key] ?? { subject: "", teacher: "" };
                    const clash = s.teacher ? busy[`${s.teacher}:${key}`] : undefined;
                    return (
                      <td
                        key={d}
                        className={`rounded-lg p-1.5 align-top ${
                          clash ? "bg-danger-soft ring-1 ring-inset ring-danger-line" : s.subject ? "bg-accent-soft/60" : "bg-surface-2/60"
                        }`}
                      >
                        <select
                          name={`subject:${key}`}
                          value={s.subject}
                          aria-label={`${DAY_SHORT[d]} ${p.name} subject`}
                          onChange={(e) => {
                            const subject = e.target.value;
                            set(key, { subject, teacher: subject && !subject.startsWith("label:") ? (subjectTeacher[subject] ?? s.teacher) : subject ? s.teacher : "" });
                          }}
                          className="w-full rounded-md border border-line bg-surface px-1.5 py-1 text-xs font-medium text-fg focus:border-accent focus:outline-none"
                        >
                          <option value="">—</option>
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                          <optgroup label="Other">
                            {SLOT_LABELS.map((l) => (
                              <option key={l} value={`label:${l}`}>
                                {l}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        {s.subject && (
                          <select
                            name={`teacher:${key}`}
                            value={s.teacher}
                            aria-label={`${DAY_SHORT[d]} ${p.name} teacher`}
                            onChange={(e) => set(key, { ...s, teacher: e.target.value })}
                            className="mt-1 w-full rounded-md border border-line bg-surface px-1.5 py-1 text-[11px] text-fg-2 focus:border-accent focus:outline-none"
                          >
                            <option value="">No teacher</option>
                            {teachers.map((t) => {
                              const other = busy[`${t.id}:${key}`];
                              return (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                  {other ? ` (busy: ${other})` : ""}
                                </option>
                              );
                            })}
                          </select>
                        )}
                        {clash && <p className="mt-1 text-[11px] font-medium text-danger">Busy in {clash}</p>}
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <SubmitButton icon={<Save className="h-4 w-4" />}>Save timetable</SubmitButton>
      </div>
    </ActionForm>
  );
}
