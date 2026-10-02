"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { CircleCheck, EyeOff, FileBarChart, Loader2, Lock, Save, Send } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Badge, buttonVariants, checkboxClass, useConfirm, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { PASS_PERCENT, formatExamDate, formatMarks, gradeFor, parseMark, passes } from "@/lib/exams-shared";

export type GridData = {
  section: { label: string };
  papers: { id: string; name: string; date: string; maxMarks: number; optional: boolean; passMarks: number | null; editable: boolean }[];
  ungraded: number;
  students: { id: string; name: string; rollNumber: number | null; studentCode: string; eligible: string[] }[];
  marks: Record<string, { marks: number | null; absent: boolean }>;
  published: { at: string; by: string } | null;
  canPublish: boolean;
  enterAll: boolean;
};

const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/**
 * Spreadsheet for typing marks: Enter / arrow keys move between cells; "AB" marks
 * one paper absent, and the row's Absent box marks the student absent for every
 * paper you enter (locking those cells).
 */
export function MarksGrid({
  data,
  save,
  publish,
  unpublish,
  resultsHref,
}: {
  data: GridData;
  save: (state: ActionState, formData: FormData) => Promise<ActionState>;
  publish: () => Promise<ActionState>;
  unpublish: () => Promise<ActionState>;
  resultsHref: string;
}) {
  const { papers, students, published } = data;
  const initial = useMemo(() => {
    const v: Record<string, string> = {};
    for (const [key, cell] of Object.entries(data.marks)) v[key] = cell.absent ? "AB" : formatMarks(cell.marks ?? 0);
    return v;
  }, [data.marks]);
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, formAction, saving] = useActionState(save, {});
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [publishState, setPublishState] = useState<ActionState>({});
  const [publishing, startPublishing] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  const changed = Object.keys({ ...values, ...saved }).filter((k) => (values[k] ?? "") !== (saved[k] ?? ""));
  const dirty = changed.length > 0;
  const locked = !!published;

  // Fresh data from the server after a save or publish.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setSaved(initial);
    if (!dirty || state.ok) setValues(initial);
  }
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setErrors(state.fieldErrors ?? {});
  }

  useEffect(() => {
    if (state.ok) toast({ title: state.message ?? "Marks saved" });
    else if (state.error) toast({ title: state.error, tone: "error" });
  }, [state, toast]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const key = (p: string, s: string) => `${p}:${s}`;
  const set = (p: string, s: string, v: string) => {
    setValues((prev) => ({ ...prev, [key(p, s)]: v }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`m.${p}.${s}`];
      return next;
    });
  };

  const submit = () => {
    const fd = new FormData();
    fd.set(
      "marks",
      JSON.stringify(
        changed.map((k) => {
          const [p, s] = k.split(":");
          return { p, s, v: values[k] ?? "" };
        }),
      ),
    );
    startTransition(() => formAction(fd));
  };

  // The papers of a student this user enters; the Absent box applies to these.
  const mineFor = (s: (typeof students)[number]) => papers.filter((p) => p.editable && s.eligible.includes(p.id));
  const isAbsent = (s: (typeof students)[number]) => {
    const mine = mineFor(s);
    return mine.length > 0 && mine.every((p) => values[key(p.id, s.id)] === "AB");
  };
  const setAbsent = (s: (typeof students)[number], absent: boolean) => {
    const mine = mineFor(s);
    setValues((prev) => {
      const next = { ...prev };
      for (const p of mine) next[key(p.id, s.id)] = absent ? "AB" : "";
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      for (const p of mine) delete next[`m.${p.id}.${s.id}`];
      return next;
    });
  };
  const showAbsent = !locked && papers.some((p) => p.editable);

  // Totals from what is typed now (invalid cells count as missing). Optional papers aren't totalled.
  const totals = students.map((s) => {
    let got = 0;
    let max = 0;
    let complete = true;
    let failed = false;
    let taken = 0;
    let absences = 0;
    for (const p of papers) {
      if (!s.eligible.includes(p.id)) continue;
      taken++;
      const parsed = parseMark(values[key(p.id, s.id)] ?? "", p.maxMarks);
      if ("absent" in parsed) absences++;
      if (p.optional) continue;
      max += p.maxMarks;
      if ("marks" in parsed) {
        got += parsed.marks;
        if (!passes(parsed.marks, p)) failed = true;
      } else if ("absent" in parsed) failed = true;
      else complete = false;
    }
    return { got, max, complete, failed, absent: taken > 0 && absences === taken, percent: max ? (got / max) * 100 : 0 };
  });

  let required = 0;
  let filled = 0;
  let mine = 0;
  let mineFilled = 0;
  for (const p of papers) {
    for (const s of students) {
      if (!s.eligible.includes(p.id)) continue;
      const done = !!(saved[key(p.id, s.id)] ?? "");
      required++;
      if (done) filled++;
      if (p.editable) {
        mine++;
        if (done) mineFilled++;
      }
    }
  }

  const move = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${row}:${col}"]`);
    el?.focus();
    el?.select();
  };

  const th = "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted";
  return (
    <div>
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 text-sm sm:px-6">
        {locked ? (
          <Badge tone="green">
            <Lock className="h-3 w-3" />
            Published {stamp.format(new Date(published!.at))} by {published!.by}
          </Badge>
        ) : (
          <Badge tone="amber" dot>
            Not published
          </Badge>
        )}
        <Progress label={data.enterAll ? "All marks" : "Your papers"} done={data.enterAll ? filled : mineFilled} total={data.enterAll ? required : mine} />
        {!data.enterAll && <Progress label="Whole class" done={filled} total={required} />}
        <Link href={resultsHref} className="ml-auto inline-flex items-center gap-1.5 font-medium text-accent-text underline-offset-4 hover:underline">
          <FileBarChart className="h-4 w-4" />
          {locked ? "Results & report cards" : data.canPublish ? "Preview results" : "Results"}
        </Link>
      </div>

      {data.ungraded > 0 && (
        <p className="border-b border-line bg-surface-2 px-6 py-2 text-xs text-muted">
          {data.ungraded} paper{data.ungraded === 1 ? " has" : "s have"} no max marks, so {data.ungraded === 1 ? "it isn't" : "they aren't"} graded. Add max marks in the timetable to include {data.ungraded === 1 ? "it" : "them"}.
        </p>
      )}

      {papers.length === 0 || students.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">
          {students.length === 0 ? "There are no students in this section." : "No paper for this class has max marks yet. Add max marks in the timetable to enter marks."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-surface-2/80">
              <tr>
                <th className={`${th} sticky left-0 z-10 bg-surface-2 pl-6`}>Student</th>
                {showAbsent && <th className={`${th} text-center`}>Absent</th>}
                {papers.map((p) => (
                  <th key={p.id} className={`${th} text-center normal-case tracking-normal`}>
                    <span className={`block text-xs font-semibold ${p.editable && !locked ? "text-fg" : "text-muted"}`}>{p.name}</span>
                    <span className="block text-[11px] font-normal text-muted">
                      {formatExamDate(p.date)} · MM {p.maxMarks}
                      {p.optional && ` · optional, pass ${p.passMarks}`}
                    </span>
                  </th>
                ))}
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} pr-6 text-right`}>%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s, row) => {
                const t = totals[row];
                const absent = isAbsent(s);
                return (
                  <tr key={s.id} className={absent ? "bg-surface-2/70" : "hover:bg-surface-2/60"}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2 pl-6">
                      <span className="mr-2 inline-block w-6 text-right text-xs tabular-nums text-subtle">{s.rollNumber ?? "—"}</span>
                      <span className={`font-medium ${absent ? "text-muted line-through decoration-1" : "text-fg"}`}>{s.name}</span>
                    </td>
                    {showAbsent && (
                      <td className="px-3 py-2 text-center">
                        {mineFor(s).length > 0 && (
                          <input
                            type="checkbox"
                            checked={absent}
                            onChange={(e) => setAbsent(s, e.target.checked)}
                            aria-label={`${s.name} absent`}
                            title={absent ? "Untick to enter marks" : "Mark absent for every paper you enter"}
                            className={checkboxClass}
                          />
                        )}
                      </td>
                    )}
                    {papers.map((p, col) => {
                      const k = key(p.id, s.id);
                      const err = errors[`m.${p.id}.${s.id}`]?.[0];
                      if (!s.eligible.includes(p.id)) {
                        return (
                          <td key={p.id} className="px-3 py-2 text-center text-xs text-subtle" title={`${s.name} doesn't take this subject`}>
                            N/A
                          </td>
                        );
                      }
                      const v = values[k] ?? "";
                      const parsed = parseMark(v, p.maxMarks);
                      const low = "marks" in parsed && !passes(parsed.marks, p);
                      if (!p.editable || locked || absent) {
                        return (
                          <td key={p.id} className={`px-3 py-2 text-center tabular-nums ${v === "AB" ? "font-medium text-danger" : low ? "text-danger" : "text-fg-2"}`}>
                            {v || <span className="text-subtle">—</span>}
                          </td>
                        );
                      }
                      return (
                        <td key={p.id} className="px-2 py-1.5 text-center">
                          <input
                            data-cell={`${row}:${col}`}
                            value={v}
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`${s.name} – ${p.name} (out of ${p.maxMarks})`}
                            title={err}
                            onChange={(e) => set(p.id, s.id, e.target.value.toUpperCase().slice(0, 7))}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "ArrowDown") {
                                e.preventDefault();
                                move(row + 1, col);
                              } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                move(row - 1, col);
                              }
                            }}
                            className={`w-16 rounded-lg border px-2 py-1.5 text-center tabular-nums outline-none transition focus:ring-4 ${
                              err || "error" in parsed
                                ? "border-danger-solid bg-danger-soft text-danger focus:ring-danger-solid/15"
                                : v === "AB"
                                  ? "border-danger-line bg-danger-soft/50 font-medium text-danger focus:border-accent focus:ring-accent/15"
                                  : `border-line focus:border-accent focus:ring-accent/15 ${low ? "text-danger" : "text-fg"} ${(saved[k] ?? "") !== v ? "bg-warning-soft" : "bg-surface"}`
                            }`}
                          />
                          {(err || "error" in parsed) && <p className="mt-0.5 text-[11px] leading-tight text-danger">{err ?? ("error" in parsed ? parsed.error : "")}</p>}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-fg-2">
                      {t.absent ? (
                        <span className="font-medium text-danger">Absent</span>
                      ) : t.max ? (
                        <>
                          <span className="font-semibold text-fg">{formatMarks(t.got)}</span>
                          <span className="text-subtle">/{t.max}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 pr-6 text-right tabular-nums">
                      {t.complete && t.max && !t.absent ? (
                        <span className={t.failed ? "text-danger" : "text-fg"}>
                          {t.percent.toFixed(1)} <span className="text-xs text-subtle">{gradeFor(t.percent)}</span>
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Save and publish */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-b-2xl border-t border-line bg-glass px-4 py-4 backdrop-blur-xl sm:px-6 md:bottom-0 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1 space-y-2">
          <FormMessage state={state.error ? state : {}} />
          <FormMessage state={publishState} />
          {!locked && papers.some((p) => p.editable) && (
            <p className="text-xs text-muted">
              Type marks, or AB for absent in one paper. Tick Absent to mark a student absent for all your papers. Enter moves down. Marks below {PASS_PERCENT}% (or an
              optional paper&apos;s pass marks) show in red.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!locked && papers.some((p) => p.editable) && (
            <button type="button" onClick={submit} disabled={saving || !dirty} className={buttonVariants.primary}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? <Save className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
              {dirty ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "All saved"}
            </button>
          )}
          {data.canPublish &&
            (locked ? (
              <button
                type="button"
                disabled={publishing}
                onClick={async () => {
                  if (!(await confirm({ title: "Unpublish these results?", message: "Marks become editable again.", confirmLabel: "Unpublish" }))) return;
                  startPublishing(async () => {
                    const r = await unpublish();
                    setPublishState(r);
                    if (r.ok) toast({ title: r.message ?? "Results unpublished" });
                  });
                }}
                className={buttonVariants.secondary}
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                Unpublish results
              </button>
            ) : (
              <button
                type="button"
                disabled={publishing || dirty || filled < required || required === 0}
                title={dirty ? "Save your changes first" : filled < required ? `${required - filled} mark(s) still missing` : undefined}
                onClick={async () => {
                  if (!(await confirm({ title: `Publish results for ${data.section.label}?`, message: "Marks will be locked and report cards become available.", confirmLabel: "Publish" }))) return;
                  startPublishing(async () => {
                    const r = await publish();
                    setPublishState(r);
                    if (r.ok) toast({ title: r.message ?? "Results published", description: "Report cards are ready." });
                  });
                }}
                className={filled >= required && required > 0 ? buttonVariants.primary : buttonVariants.secondary}
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : filled >= required && required > 0 ? <Send className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
                {filled >= required && required > 0 ? "Publish results" : `Publish (${required - filled} missing)`}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="flex items-center gap-2 text-xs text-fg-2">
      {label}
      <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-3">
        <span className={`block h-full rounded-full transition-[width] duration-500 ease-out ${pct === 100 ? "bg-success-solid" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}
