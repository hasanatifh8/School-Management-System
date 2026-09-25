"use client";

import { startTransition, useActionState, useMemo, useState, useTransition } from "react";
import { CalendarOff, CheckCheck, Loader2, PartyPopper, Save, Sun, Undo2 } from "lucide-react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/forms";
import { Avatar, buttonVariants, inputClass } from "@/components/ui";
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
}) {
  const start = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, initial?.[s.id] ?? { status: "PRESENT" as const, remark: "" }])),
    [students, initial],
  );
  const [marks, setMarks] = useState<Record<string, Mark>>(start);
  const [savedMarks, setSavedMarks] = useState(start);
  const [state, formAction, saving] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await save(prev, fd);
    if (result.ok) setSavedMarks(marksFromForm(fd, students));
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
            className={`${buttonVariants.secondary} mt-3 !py-2`}
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
        className="rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
            {ATTENDANCE_STATUSES.map((s) => (
              <span key={s} className={`rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-slate-200 ${STATUS_META[s].text}`}>
                {STATUS_META[s].label} <span className="tabular-nums">{counts[s]}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, { ...marks[s.id], status: "PRESENT" }])))}
              className={`${buttonVariants.ghost} !py-1.5 text-xs`}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all present
            </button>
          </div>
        </div>

        <ul className="divide-y divide-slate-100">
          {students.map((s) => {
            const mark = marks[s.id];
            return (
              <li key={s.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 ${mark.status === "ABSENT" ? "bg-rose-50/40" : ""}`}>
                <span className="w-7 shrink-0 text-right font-mono text-xs text-slate-400">{s.roll ?? "—"}</span>
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                  <Avatar name={s.name} src={s.photoUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{s.code}</p>
                  </div>
                </div>
                <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex gap-1">
                  {ATTENDANCE_STATUSES.map((st) => {
                    const on = mark.status === st;
                    return (
                      <label
                        key={st}
                        title={STATUS_META[st].label}
                        className={`flex h-8 min-w-9 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-semibold ring-1 ring-inset transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                          on ? STATUS_META[st].on : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
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
                  value={mark.remark}
                  onChange={(e) => set(s.id, { remark: e.target.value })}
                  maxLength={120}
                  placeholder="Remark"
                  aria-label={`Remark for ${s.name}`}
                  className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none sm:w-40"
                />
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0 flex-1 text-sm">
            {state.error || (state.ok && !dirty) ? (
              <FormMessage state={state} compact />
            ) : dirty ? (
              <span className="text-xs font-medium text-amber-700">Unsaved changes</span>
            ) : initial ? (
              <span className="text-xs text-slate-500">Saved{markedBy ? ` by ${markedBy}` : ""}</span>
            ) : (
              <span className="text-xs text-slate-500">Not marked yet. Everyone starts as present.</span>
            )}
          </div>
          <button type="submit" disabled={saving} className={buttonVariants.primary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : initial ? "Update attendance" : "Save attendance"}
          </button>
        </div>
      </form>

      <details className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-sm font-medium text-slate-700">
          <CalendarOff className="h-4 w-4 text-slate-400" />
          Class off today? Mark it as a holiday
        </summary>
        <ActionForm action={setHoliday} className="space-y-3 border-t border-slate-100 px-6 py-4">
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
  violet: "border-violet-200 bg-violet-50/70 text-violet-900 [&_svg.lead]:text-violet-500",
  amber: "border-amber-200 bg-amber-50/70 text-amber-900 [&_svg.lead]:text-amber-500",
  slate: "border-slate-200 bg-white text-slate-700 [&_svg.lead]:text-slate-400",
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
