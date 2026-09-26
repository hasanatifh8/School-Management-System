"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarPlus, Copy, Loader2, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MAX_PAPERS, emptyPaper, formatDay, type PaperInput } from "@/lib/exams-shared";

type Option = { id: string; name: string };

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: PaperInput[];
  classes: Option[];
  subjects: (Option & { code: string })[];
  /** Subjects allowed per class id ("" = a paper for every class). */
  allowed: Record<string, string[]>;
  /** Each class's own subjects, listed first for admins. */
  curricula: Record<string, string[]>;
  /** Teachers may only pick allowed subjects. */
  restrict: boolean;
  sessionStart: string;
  sessionEnd: string;
  today: string;
};

const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isSunday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
/** The next day after `iso` that isn't a Sunday. */
const nextWorkingDay = (iso: string) => {
  let d = addDaysISO(iso, 1);
  while (isSunday(d)) d = addDaysISO(d, 1);
  return d;
};
const byDateTime = (a: PaperInput, b: PaperInput) =>
  (a.date || "9999").localeCompare(b.date || "9999") || a.startTime.localeCompare(b.startTime) || a.classId.localeCompare(b.classId);

/** Spreadsheet-like date sheet editor; saves every row at once. */
export function TimetableEditor(props: Props) {
  const { classes, subjects, allowed, curricula, restrict, sessionStart, sessionEnd, today } = props;
  const [rows, setRows] = useState<PaperInput[]>(props.initial);
  const [saved, setSaved] = useState(() => JSON.stringify(props.initial));
  const [state, formAction, pending] = useActionState(props.action, {});
  const [errors, setErrors] = useState<ActionState["fieldErrors"]>({});
  const [fillOpen, setFillOpen] = useState(false);
  const dirty = JSON.stringify(rows) !== saved;
  const multiClass = classes.length > 1;
  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);

  // Fresh server data (e.g. new papers now have ids): follow it unless there are unsaved edits.
  const initialJson = JSON.stringify(props.initial);
  const [lastInitial, setLastInitial] = useState(initialJson);
  if (initialJson !== lastInitial) {
    setLastInitial(initialJson);
    if (!dirty || state.ok) {
      setRows(props.initial);
      setSaved(initialJson);
    }
  }

  // Server result: show cell errors, or mark the rows as saved.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setErrors(state.fieldErrors ?? {});
    if (state.ok) setSaved(JSON.stringify(rows));
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const cellError = (i: number, field: keyof PaperInput) => errors?.[`papers.${i}.${field}`]?.[0];

  /** Row edits keep other rows' errors; adding, removing or moving rows clears them (row numbers change). */
  const update = (i: number, patch: Partial<PaperInput>) => {
    setRows((r) => r.map((row, k) => (k === i ? { ...row, ...patch } : row)));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[`papers.${i}.${key}`];
      return next;
    });
  };
  const restructure = (next: PaperInput[]) => {
    setRows(next);
    setErrors({});
  };

  const addRow = () => {
    const last = rows.at(-1);
    const start = today > sessionStart ? today : sessionStart;
    const row = last
      ? { ...emptyPaper(), date: last.date ? nextWorkingDay(last.date) : "", startTime: last.startTime, endTime: last.endTime, classId: last.classId, maxMarks: last.maxMarks, room: last.room }
      : { ...emptyPaper(), date: isSunday(start) ? nextWorkingDay(start) : start };
    restructure([...rows, row]);
  };

  const subjectChoices = (classId: string) => {
    const ok = new Set(allowed[classId] ?? []);
    const own = new Set(curricula[classId] ?? []);
    const usable = subjects.filter((s) => ok.has(s.id));
    if (restrict) return { first: usable, rest: [] as typeof subjects };
    return { first: usable.filter((s) => own.has(s.id)), rest: usable.filter((s) => !own.has(s.id)) };
  };

  const save = () => {
    const fd = new FormData();
    fd.set("papers", JSON.stringify(rows));
    startTransition(() => formAction(fd));
  };

  const th = "whitespace-nowrap px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 first:pl-4";
  const cell = "px-2 py-2 align-top first:pl-4";
  const small = `${inputClass} !px-2.5 !py-2`;
  const err = (msg?: string) => (msg ? <p className="mt-1 max-w-56 text-xs font-medium leading-snug text-rose-600">{msg}</p> : null);
  const bad = (msg?: string) => (msg ? "!border-rose-400 !ring-rose-500/10" : "");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3">
        <button type="button" onClick={addRow} disabled={rows.length >= MAX_PAPERS} className={`${buttonVariants.secondary} !py-2`}>
          <Plus className="h-4 w-4" />
          Add paper
        </button>
        <button type="button" onClick={() => setFillOpen((v) => !v)} className={`${buttonVariants.secondary} !py-2`}>
          <Wand2 className="h-4 w-4" />
          Fill from subjects
        </button>
        {rows.length > 1 && (
          <button type="button" onClick={() => restructure([...rows].sort(byDateTime))} className={`${buttonVariants.ghost} !py-2`}>
            <ArrowUpDown className="h-4 w-4" />
            Sort by date
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {rows.length} paper{rows.length === 1 ? "" : "s"}
          {dirty && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">Unsaved changes</span>}
        </span>
      </div>

      {fillOpen && (
        <FillPanel
          classes={classes}
          multiClass={multiClass}
          subjectChoices={subjectChoices}
          defaultStart={rows.length && rows.at(-1)!.date ? nextWorkingDay(rows.at(-1)!.date) : today > sessionStart ? today : sessionStart}
          min={sessionStart}
          max={sessionEnd}
          onClose={() => setFillOpen(false)}
          onFill={(added) => {
            restructure([...rows, ...added].slice(0, MAX_PAPERS));
            setFillOpen(false);
          }}
        />
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <CalendarPlus className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-900">No papers yet</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Add papers one by one, or use “Fill from subjects” to add one paper per subject on consecutive days.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80">
              <tr>
                <th className={th}>#</th>
                <th className={th}>Date</th>
                <th className={th}>From</th>
                <th className={th}>To</th>
                {multiClass && <th className={th}>Class</th>}
                <th className={th}>Subject / paper</th>
                <th className={th}>Max marks</th>
                <th className={th}>Room</th>
                <th className={th}>Notes</th>
                <th className={th}>
                  <span className="sr-only">Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const { first, rest } = subjectChoices(r.classId);
                const listed = new Set([...first, ...rest].map((s) => s.id));
                return (
                  <tr key={i} className={Object.keys(errors ?? {}).some((k) => k.startsWith(`papers.${i}.`)) ? "bg-rose-50/40" : ""}>
                    <td className={`${cell} pt-4 text-xs font-medium tabular-nums text-slate-400`}>{i + 1}</td>
                    <td className={cell}>
                      <input
                        type="date"
                        value={r.date}
                        min={sessionStart}
                        max={sessionEnd}
                        onChange={(e) => update(i, { date: e.target.value })}
                        aria-label={`Row ${i + 1} date`}
                        className={`${small} w-40 ${bad(cellError(i, "date"))}`}
                      />
                      {r.date && !cellError(i, "date") && (
                        <p className={`mt-1 text-xs ${isSunday(r.date) ? "font-medium text-amber-600" : "text-slate-500"}`}>{formatDay(r.date)}</p>
                      )}
                      {err(cellError(i, "date"))}
                    </td>
                    <td className={cell}>
                      <input
                        type="time"
                        value={r.startTime}
                        onChange={(e) => update(i, { startTime: e.target.value })}
                        aria-label={`Row ${i + 1} start time`}
                        className={`${small} w-32 ${bad(cellError(i, "startTime"))}`}
                      />
                      {err(cellError(i, "startTime"))}
                    </td>
                    <td className={cell}>
                      <input
                        type="time"
                        value={r.endTime}
                        onChange={(e) => update(i, { endTime: e.target.value })}
                        aria-label={`Row ${i + 1} end time`}
                        className={`${small} w-32 ${bad(cellError(i, "endTime"))}`}
                      />
                      {err(cellError(i, "endTime"))}
                    </td>
                    {multiClass && (
                      <td className={cell}>
                        <select
                          value={r.classId}
                          onChange={(e) => update(i, { classId: e.target.value })}
                          aria-label={`Row ${i + 1} class`}
                          className={`${selectClass} !w-36 !py-2 ${bad(cellError(i, "classId"))}`}
                        >
                          <option value="">All classes</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {err(cellError(i, "classId"))}
                      </td>
                    )}
                    <td className={cell}>
                      <div className="flex w-64 flex-col gap-1.5">
                        <select
                          value={r.subjectId}
                          onChange={(e) => update(i, { subjectId: e.target.value })}
                          aria-label={`Row ${i + 1} subject`}
                          className={`${selectClass} !py-2 ${bad(cellError(i, "subjectId"))}`}
                        >
                          <option value="">No subject (use paper name)</option>
                          {r.subjectId && !listed.has(r.subjectId) && (
                            <option value={r.subjectId}>{subjectName.get(r.subjectId) ?? "Unknown subject"} (not available)</option>
                          )}
                          {rest.length ? (
                            <>
                              <optgroup label="Class subjects">
                                {first.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Other subjects">
                                {rest.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </optgroup>
                            </>
                          ) : (
                            first.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))
                          )}
                        </select>
                        <input
                          value={r.title}
                          maxLength={60}
                          onChange={(e) => update(i, { title: e.target.value })}
                          placeholder={r.subjectId ? "Paper name (optional), e.g. Practical" : "Paper name, e.g. Drawing"}
                          aria-label={`Row ${i + 1} paper name`}
                          className={`${small} ${bad(cellError(i, "title"))}`}
                        />
                      </div>
                      {err(cellError(i, "subjectId") ?? cellError(i, "title"))}
                    </td>
                    <td className={cell}>
                      <input
                        inputMode="numeric"
                        value={r.maxMarks}
                        onChange={(e) => update(i, { maxMarks: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        placeholder="e.g. 80"
                        aria-label={`Row ${i + 1} maximum marks`}
                        className={`${small} w-24 ${bad(cellError(i, "maxMarks"))}`}
                      />
                      {err(cellError(i, "maxMarks"))}
                    </td>
                    <td className={cell}>
                      <input
                        value={r.room}
                        maxLength={40}
                        onChange={(e) => update(i, { room: e.target.value })}
                        placeholder="e.g. Hall 1"
                        aria-label={`Row ${i + 1} room`}
                        className={`${small} w-28 ${bad(cellError(i, "room"))}`}
                      />
                      {err(cellError(i, "room"))}
                    </td>
                    <td className={cell}>
                      <input
                        value={r.notes}
                        maxLength={120}
                        onChange={(e) => update(i, { notes: e.target.value })}
                        placeholder="e.g. Bring geometry box"
                        aria-label={`Row ${i + 1} notes`}
                        className={`${small} w-48 ${bad(cellError(i, "notes"))}`}
                      />
                      {err(cellError(i, "notes"))}
                    </td>
                    <td className={`${cell} pr-4`}>
                      <div className="flex items-center gap-0.5">
                        <IconButton label="Move up" disabled={i === 0} onClick={() => restructure(swap(rows, i, i - 1))}>
                          <ArrowUp className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Move down" disabled={i === rows.length - 1} onClick={() => restructure(swap(rows, i, i + 1))}>
                          <ArrowDown className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Duplicate"
                          disabled={rows.length >= MAX_PAPERS}
                          onClick={() => restructure([...rows.slice(0, i + 1), { ...r, id: "" }, ...rows.slice(i + 1)])}
                        >
                          <Copy className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Remove" danger onClick={() => restructure(rows.filter((_, k) => k !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <FormMessage state={dirty && state.ok ? {} : state} />
        </div>
        <button type="button" onClick={save} disabled={pending || !dirty} className={buttonVariants.primary}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "Saving…" : "Save timetable"}
        </button>
      </div>
    </div>
  );
}

function swap<T>(list: T[], a: number, b: number) {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 transition disabled:pointer-events-none disabled:opacity-30 ${danger ? "text-rose-500 hover:bg-rose-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
    >
      {children}
    </button>
  );
}

/** Adds one paper per chosen subject on consecutive working days. */
function FillPanel({
  classes,
  multiClass,
  subjectChoices,
  defaultStart,
  min,
  max,
  onClose,
  onFill,
}: {
  classes: Option[];
  multiClass: boolean;
  subjectChoices: (classId: string) => { first: Option[]; rest: Option[] };
  defaultStart: string;
  min: string;
  max: string;
  onClose: () => void;
  onFill: (rows: PaperInput[]) => void;
}) {
  const [classId, setClassId] = useState(multiClass ? "" : (classes[0]?.id ?? ""));
  const { first, rest } = subjectChoices(classId);
  const options = first.length ? first : rest;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(options.map((s) => s.id)));
  const [start, setStart] = useState(defaultStart);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("12:00");
  const [gap, setGap] = useState(1);
  const [skipSundays, setSkipSundays] = useState(true);
  const [marks, setMarks] = useState("");

  const chooseClass = (id: string) => {
    setClassId(id);
    const c = subjectChoices(id);
    setPicked(new Set((c.first.length ? c.first : c.rest).map((s) => s.id)));
  };

  const fill = () => {
    const out: PaperInput[] = [];
    let date = start;
    for (const s of options.filter((o) => picked.has(o.id))) {
      while (skipSundays && isSunday(date)) date = addDaysISO(date, 1);
      out.push({ ...emptyPaper(), date, startTime: from, endTime: to, classId: multiClass ? classId : "", subjectId: s.id, maxMarks: marks });
      date = addDaysISO(date, gap);
    }
    onFill(out);
  };

  const label = "mb-1.5 block text-xs font-medium text-slate-600";
  return (
    <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Fill from subjects</p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {multiClass && (
          <label>
            <span className={label}>Class</span>
            <select value={classId} onChange={(e) => chooseClass(e.target.value)} className={`${selectClass} !py-2`}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className={label}>First date</span>
          <input type="date" value={start} min={min} max={max} onChange={(e) => setStart(e.target.value)} className={`${inputClass} !py-2`} />
        </label>
        <label>
          <span className={label}>From</span>
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} !py-2`} />
        </label>
        <label>
          <span className={label}>To</span>
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} !py-2`} />
        </label>
        <label>
          <span className={label}>Days between papers</span>
          <select value={gap} onChange={(e) => setGap(Number(e.target.value))} className={`${selectClass} !py-2`}>
            <option value={1}>Next day</option>
            <option value={2}>1 day gap</option>
            <option value={3}>2 days gap</option>
          </select>
        </label>
        <label>
          <span className={label}>Max marks</span>
          <input inputMode="numeric" value={marks} onChange={(e) => setMarks(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Optional" className={`${inputClass} !py-2`} />
        </label>
      </div>
      <div className="mt-3">
        <span className={label}>Subjects, in this order</span>
        {options.length === 0 ? (
          <p className="text-sm text-slate-500">No subjects available for this choice.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {options.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-inset ${picked.has(s.id) ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-white text-slate-600 ring-slate-200"}`}
              >
                <input
                  type="checkbox"
                  checked={picked.has(s.id)}
                  onChange={(e) =>
                    setPicked((p) => {
                      const next = new Set(p);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    })
                  }
                  className="sr-only"
                />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={skipSundays} onChange={(e) => setSkipSundays(e.target.checked)} className={checkboxClass} />
          Skip Sundays
        </label>
        <button type="button" onClick={fill} disabled={!picked.size || !start} className={`${buttonVariants.primary} !py-2`}>
          <Plus className="h-4 w-4" />
          Add {picked.size} paper{picked.size === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
