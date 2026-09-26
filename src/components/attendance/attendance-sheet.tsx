"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, CalendarOff, CheckCheck, CircleCheck, Keyboard, Loader2, PartyPopper, Save, Sun, Undo2 } from "lucide-react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/forms";
import { Avatar, Button, buttonClass, buttonVariants, inputClass, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { ATTENDANCE_STATUSES, STATUS_META, emptyCounts, type AttendanceStatusKey } from "@/lib/attendance-shared";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Mark = { status: AttendanceStatusKey; remark: string };

export type SheetStudent = { id: string; name: string; roll: number | null; photoUrl: string | null; code: string };

/**
 * Take or edit one class's attendance for one day. Everyone starts as Present
 * on a day that isn't marked yet; nothing is saved until "Save attendance".
 */
export function AttendanceSheet({
  students,
  initial,
  markedBy,
  schoolHoliday,
  classHoliday,
  sunday,
  save,
  setHoliday,
  clearHoliday,
  next,
}: {
  students: SheetStudent[];
  /** Saved marks, or null when this day hasn't been marked yet. */
  initial: Record<string, Mark> | null;
  markedBy: string | null;
  schoolHoliday: string | null;
  classHoliday: string | null;
  sunday: boolean;
  save: Action;
  setHoliday: Action;
  clearHoliday: () => Promise<ActionState>;
  /** The next class still to mark on this date (admin view), offered after saving. */
  next?: { href: string; label: string } | null;
}) {
  const start = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, initial?.[s.id] ?? { status: "PRESENT" as const, remark: "" }])),
    [students, initial],
  );
  const [marks, setMarks] = useState<Record<string, Mark>>(start);
  const [savedMarks, setSavedMarks] = useState(start);
  const toast = useToast();
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const [state, formAction, saving] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await save(prev, fd);
    if (result.ok) {
      setSavedMarks(marksFromForm(fd, students));
      toast({ title: result.message ?? "Attendance saved", description: next ? `Next up: ${next.label}` : undefined });
    }
    return result;
  }, {});
  const [clearState, setClearState] = useState<ActionState>({});
  const [clearing, startClearing] = useTransition();

  const counts = useMemo(() => {
    const c = emptyCounts();
    for (const m of Object.values(marks)) c[m.status]++;
    return c;
  }, [marks]);
  const dirty = students.some((s) => marks[s.id].status !== savedMarks[s.id].status || marks[s.id].remark !== savedMarks[s.id].remark);
  const set = (id: string, patch: Partial<Mark>) => setMarks((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  if (schoolHoliday) {
    return (
      <Banner icon={PartyPopper} tone="violet" title={`School holiday: ${schoolHoliday}`}>
        No attendance is taken today. The school admin manages school holidays.
      </Banner>
    );
  }

  if (classHoliday) {
    return (
      <div className="space-y-3">
        <Banner icon={CalendarOff} tone="violet" title={`Class holiday: ${classHoliday}`}>
          This class was marked as off{markedBy ? ` by ${markedBy}` : ""}. It doesn&apos;t count as a working day.
          <button
            type="button"
            disabled={clearing}
            onClick={() => startClearing(async () => setClearState(await clearHoliday()))}
            className={`${buttonVariants.secondary} mt-3`}
          >
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Remove holiday and take attendance
          </button>
        </Banner>
        <FormMessage state={clearState} />
      </div>
    );
  }

  if (!students.length) {
    return <Banner icon={CalendarOff} tone="slate" title="No students in this class">Add students to the class to take attendance.</Banner>;
  }

  const total = students.length;
  const attending = counts.PRESENT + counts.LATE + counts.HALF_DAY;
  const saved = state.ok && !dirty;

  // P / A / L / H / V marks the focused student and moves to the next one.
  function onRowKey(e: React.KeyboardEvent, index: number, id: string) {
    if ((e.target as HTMLElement).dataset.remark !== undefined || e.metaKey || e.ctrlKey || e.altKey) return;
    const status = ATTENDANCE_STATUSES.find((st) => STATUS_META[st].key === e.key.toLowerCase());
    if (!status) return;
    e.preventDefault();
    set(id, { status });
    const next = rows.current[index + 1];
    // Focus the next student's selected pill once React has re-rendered.
    requestAnimationFrame(() => next?.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus());
  }

  return (
    <div className="space-y-6">
      {sunday && (
        <Banner icon={Sun} tone="amber" title="Sunday">
          Sunday is a weekly off. Take attendance only if the school was open today.
        </Banner>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
        className="overflow-clip rounded-2xl border border-line bg-surface shadow-card"
      >
        <div className="border-b border-line px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div aria-live="polite">
              <p className="text-display-sm font-semibold tabular-nums text-fg">
                {attending}
                <span className="text-h2 font-medium text-muted"> / {total}</span>
              </p>
              <p className="text-sm text-muted">attending{counts.ABSENT ? ` · ${counts.ABSENT} absent` : ""}</p>
            </div>
            <Button variant="ghost" size="sm" icon={CheckCheck} onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, { ...marks[s.id], status: "PRESENT" }])))}>
              Mark all present
            </Button>
          </div>
          {/* Live distribution */}
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            {ATTENDANCE_STATUSES.map((st) =>
              counts[st] ? (
                <div key={st} className={`${STATUS_META[st].bar} transition-[width] duration-300 ease-out`} style={{ width: `${(counts[st] / total) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {ATTENDANCE_STATUSES.map((st) => (
              <span key={st} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${STATUS_META[st].bar}`} />
                {STATUS_META[st].label} <span className="font-semibold tabular-nums text-fg">{counts[st]}</span>
              </span>
            ))}
            <span className="ml-auto hidden items-center gap-1 lg:inline-flex">
              <Keyboard className="h-3.5 w-3.5" /> Keys: {ATTENDANCE_STATUSES.map((st) => STATUS_META[st].key.toUpperCase()).join(" · ")}
            </span>
          </div>
        </div>

        <ul className="divide-y divide-line">
          {students.map((s, i) => {
            const mark = marks[s.id];
            return (
              <li
                key={s.id}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                onKeyDown={(e) => onRowKey(e, i, s.id)}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors sm:px-6 ${mark.status === "ABSENT" ? "bg-danger-soft" : ""}`}
              >
                <span className="w-7 shrink-0 text-right font-mono text-xs text-subtle">{s.roll ?? "—"}</span>
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                  <Avatar name={s.name} src={s.photoUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{s.name}</p>
                    <p className="font-mono text-[11px] text-subtle">{s.code}</p>
                  </div>
                </div>
                <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex gap-1">
                  {ATTENDANCE_STATUSES.map((st) => {
                    const on = mark.status === st;
                    return (
                      <label
                        key={st}
                        title={`${STATUS_META[st].label} (${STATUS_META[st].key.toUpperCase()})`}
                        className={`flex h-9 min-w-10 cursor-pointer select-none items-center justify-center rounded-lg px-2 text-xs font-semibold ring-1 ring-inset transition duration-150 active:scale-95 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                          on ? `${STATUS_META[st].on} shadow-card` : "bg-surface text-muted ring-line hover:bg-surface-2 hover:text-fg"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`s:${s.id}`}
                          value={st}
                          checked={on}
                          onChange={() => set(s.id, { status: st })}
                          className="sr-only"
                          aria-label={STATUS_META[st].label}
                        />
                        {STATUS_META[st].short}
                      </label>
                    );
                  })}
                </div>
                <input
                  name={`r:${s.id}`}
                  data-remark
                  value={mark.remark}
                  onChange={(e) => set(s.id, { remark: e.target.value })}
                  maxLength={120}
                  placeholder="Remark"
                  aria-label={`Remark for ${s.name}`}
                  className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-base text-fg-2 placeholder:text-subtle transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 sm:w-40 sm:text-xs"
                />
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-glass px-4 py-3 backdrop-blur-xl sm:px-6 md:bottom-0">
          <div className="min-w-0 flex-1 text-sm">
            {state.error ? (
              <FormMessage state={state} compact />
            ) : saved ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <CircleCheck className="h-4 w-4" /> Saved
              </span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning-solid" /> Unsaved changes
              </span>
            ) : initial ? (
              <span className="text-xs text-muted">Saved{markedBy ? ` by ${markedBy}` : ""}</span>
            ) : (
              <span className="text-xs text-muted">Not marked yet. Everyone starts as present.</span>
            )}
          </div>
          {saved && next ? (
            <Link href={next.href} className={buttonClass({ variant: "primary" })}>
              Next: {next.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Button type="submit" loading={saving} icon={Save} disabled={saved}>
              {initial || saved ? "Update attendance" : "Save attendance"}
            </Button>
          )}
        </div>
      </form>

      <details className="group rounded-2xl border border-line bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-6 py-4 text-sm font-medium text-fg-2 transition hover:text-fg">
          <CalendarOff className="h-4 w-4 text-subtle" />
          Class off today? Mark it as a holiday
        </summary>
        <ActionForm action={setHoliday} className="space-y-3 border-t border-line px-6 py-4">
          {(st) => (
            <>
              <Field label="Reason" name="reason" errors={st.fieldErrors} required hint="For example: Class picnic, exam preparation leave, local holiday.">
                <input name="reason" maxLength={80} className={inputClass} />
              </Field>
              <SubmitButton
                variant="secondary"
                icon={<CalendarOff className="h-4 w-4" />}
                confirm={initial ? "Mark this day as a holiday? The attendance already saved for this day will be cleared." : undefined}
              >
                Mark as holiday
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </details>
    </div>
  );
}

/** Reads the submitted marks back out of the form data. */
function marksFromForm(fd: FormData, students: SheetStudent[]): Record<string, Mark> {
  return Object.fromEntries(
    students.map((s) => [s.id, { status: fd.get(`s:${s.id}`) as AttendanceStatusKey, remark: String(fd.get(`r:${s.id}`) ?? "") }]),
  );
}

const bannerTones = {
  violet: "border-accent-line bg-accent-soft text-fg [&_svg.lead]:text-accent-text",
  amber: "border-warning-line bg-warning-soft text-fg [&_svg.lead]:text-warning",
  slate: "border-line bg-surface text-fg-2 [&_svg.lead]:text-subtle",
};

function Banner({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Sun;
  tone: keyof typeof bannerTones;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm ${bannerTones[tone]}`}>
      <Icon className="lead mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-0.5 opacity-90">{children}</div>
      </div>
    </div>
  );
}
