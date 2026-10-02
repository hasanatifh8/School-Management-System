"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { CheckCheck, CircleCheck, Save } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Avatar, Button, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { STAFF_STATUSES, STAFF_STATUS_META, type StaffStatusKey } from "@/lib/staff-attendance-shared";

type Mark = { status: StaffStatusKey; remark: string };
type Person = { id: string; name: string; sub: string; photoUrl: string | null };

/** Mark teachers or non-teaching staff for one day: Present, Absent, Half day or On leave. */
export function StaffAttendanceSheet({
  people,
  initial,
  marked,
  markedBy,
  save,
}: {
  people: Person[];
  initial: Record<string, Mark>;
  marked: boolean;
  markedBy: string | null;
  save: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [marks, setMarks] = useState(initial);
  const [saved, setSaved] = useState(marked ? initial : null);
  const toast = useToast();
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const [state, formAction, saving] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await save(prev, fd);
    if (result.ok) {
      setSaved(marks);
      toast({ title: result.message ?? "Attendance saved" });
    }
    return result;
  }, {});
  const set = (id: string, patch: Partial<Mark>) => setMarks((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  const dirty = !saved || people.some((p) => marks[p.id].status !== saved[p.id].status || marks[p.id].remark !== saved[p.id].remark);
  const counts = useMemo(() => {
    const c = Object.fromEntries(STAFF_STATUSES.map((s) => [s, 0])) as Record<StaffStatusKey, number>;
    for (const m of Object.values(marks)) c[m.status]++;
    return c;
  }, [marks]);

  function onRowKey(e: React.KeyboardEvent, index: number, id: string) {
    if ((e.target as HTMLElement).dataset.remark !== undefined || e.metaKey || e.ctrlKey || e.altKey) return;
    const status = STAFF_STATUSES.find((st) => STAFF_STATUS_META[st].key === e.key.toLowerCase());
    if (!status) return;
    e.preventDefault();
    set(id, { status });
    requestAnimationFrame(() => rows.current[index + 1]?.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus());
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="overflow-clip rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-live="polite">
          {STAFF_STATUSES.map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STAFF_STATUS_META[st].bar}`} />
              {STAFF_STATUS_META[st].label} <span className="font-semibold tabular-nums text-fg">{counts[st]}</span>
            </span>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={CheckCheck}
          onClick={() => setMarks(Object.fromEntries(people.map((p) => [p.id, { ...marks[p.id], status: marks[p.id].status === "ON_LEAVE" ? "ON_LEAVE" : "PRESENT" }])))}
        >
          Mark all present
        </Button>
      </div>

      <ul className="divide-y divide-line">
        {people.map((p, i) => {
          const mark = marks[p.id];
          return (
            <li
              key={p.id}
              ref={(el) => {
                rows.current[i] = el;
              }}
              onKeyDown={(e) => onRowKey(e, i, p.id)}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 ${mark.status === "ABSENT" ? "bg-danger-soft" : ""}`}
            >
              <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                <Avatar name={p.name} src={p.photoUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{p.name}</p>
                  <p className="truncate text-[11px] text-subtle">{p.sub}</p>
                </div>
              </div>
              <div role="radiogroup" aria-label={`Attendance for ${p.name}`} className="flex gap-1">
                {STAFF_STATUSES.map((st) => {
                  const on = mark.status === st;
                  return (
                    <label
                      key={st}
                      title={`${STAFF_STATUS_META[st].label} (${STAFF_STATUS_META[st].key.toUpperCase()})`}
                      className={`flex h-9 min-w-10 cursor-pointer select-none items-center justify-center rounded-lg px-2 text-xs font-semibold ring-1 ring-inset transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                        on ? `${STAFF_STATUS_META[st].on} shadow-card` : "bg-surface text-muted ring-line hover:bg-surface-2 hover:text-fg"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`s:${p.id}`}
                        value={st}
                        checked={on}
                        onChange={() => set(p.id, { status: st })}
                        className="sr-only"
                        aria-label={STAFF_STATUS_META[st].label}
                      />
                      {STAFF_STATUS_META[st].short}
                    </label>
                  );
                })}
              </div>
              <input
                name={`r:${p.id}`}
                data-remark
                value={mark.remark}
                onChange={(e) => set(p.id, { remark: e.target.value })}
                maxLength={120}
                placeholder="Remark"
                aria-label={`Remark for ${p.name}`}
                className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-base text-fg-2 placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 sm:w-40 sm:text-xs"
              />
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-glass px-4 py-3 backdrop-blur-xl sm:px-6 md:bottom-0">
        <div className="min-w-0 flex-1 text-xs">
          {state.error ? (
            <FormMessage state={state} compact />
          ) : !dirty ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <CircleCheck className="h-4 w-4" /> Saved{markedBy && !state.ok ? ` by ${markedBy}` : ""}
            </span>
          ) : saved ? (
            <span className="font-medium text-warning">Unsaved changes</span>
          ) : (
            <span className="text-muted">Not marked yet. Everyone starts as present (approved leave as On leave).</span>
          )}
        </div>
        <Button type="submit" loading={saving} icon={Save} disabled={!dirty}>
          {saved ? "Update attendance" : "Save attendance"}
        </Button>
      </div>
    </form>
  );
}
