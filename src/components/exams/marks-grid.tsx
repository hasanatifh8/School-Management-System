"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { CircleCheck, EyeOff, FileBarChart, Loader2, Lock, Save, Send } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Badge, buttonVariants } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { PASS_PERCENT, formatExamDate, formatMarks, gradeFor, parseMark } from "@/lib/exams-shared";

export type GridData = {
  section: { label: string };
  papers: { id: string; name: string; date: string; maxMarks: number; editable: boolean }[];
  ungraded: number;
  students: { id: string; name: string; rollNumber: number | null; studentCode: string; eligible: string[] }[];
  marks: Record<string, { marks: number | null; absent: boolean }>;
  published: { at: string; by: string } | null;
  canPublish: boolean;
  enterAll: boolean;
};

const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** Spreadsheet for typing marks: Enter / arrow keys move between cells; "AB" marks absent. */
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

  // Totals from what is typed now (invalid cells count as missing).
  const totals = students.map((s) => {
    let got = 0;
    let max = 0;
    let complete = true;
    let failed = false;
    for (const p of papers) {
      if (!s.eligible.includes(p.id)) continue;
      max += p.maxMarks;
      const parsed = parseMark(values[key(p.id, s.id)] ?? "", p.maxMarks);
      if ("marks" in parsed) {
        got += parsed.marks;
        if ((parsed.marks / p.maxMarks) * 100 < PASS_PERCENT) failed = true;
      } else if ("absent" in parsed) failed = true;
      else complete = false;
    }
    return { got, max, complete, failed, percent: max ? (got / max) * 100 : 0 };
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

  const th = "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  return (
    <div>
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3 text-sm">
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
        <Link href={resultsHref} className="ml-auto inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-500">
          <FileBarChart className="h-4 w-4" />
          {locked ? "Results & report cards" : data.canPublish ? "Preview results" : "Results"}
        </Link>
      </div>

      {data.ungraded > 0 && (
        <p className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-xs text-slate-500">
          {data.ungraded} paper{data.ungraded === 1 ? " has" : "s have"} no max marks, so {data.ungraded === 1 ? "it isn't" : "they aren't"} graded. Add max marks in the timetable to include {data.ungraded === 1 ? "it" : "them"}.
        </p>
      )}

      {papers.length === 0 || students.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500">
          {students.length === 0 ? "There are no students in this section." : "No paper for this class has max marks yet. Add max marks in the timetable to enter marks."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80">
              <tr>
                <th className={`${th} sticky left-0 z-10 bg-slate-50 pl-6`}>Student</th>
                {papers.map((p) => (
                  <th key={p.id} className={`${th} text-center normal-case tracking-normal`}>
                    <span className={`block text-xs font-semibold ${p.editable && !locked ? "text-slate-900" : "text-slate-500"}`}>{p.name}</span>
                    <span className="block text-[11px] font-normal text-slate-500">
                      {formatExamDate(p.date)} · MM {p.maxMarks}
                    </span>
                  </th>
                ))}
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} pr-6 text-right`}>%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s, row) => {
                const t = totals[row];
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 pl-6">
                      <span className="mr-2 inline-block w-6 text-right text-xs tabular-nums text-slate-400">{s.rollNumber ?? "—"}</span>
                      <span className="font-medium text-slate-900">{s.name}</span>
                    </td>
                    {papers.map((p, col) => {
                      const k = key(p.id, s.id);
                      const err = errors[`m.${p.id}.${s.id}`]?.[0];
                      if (!s.eligible.includes(p.id)) {
                        return (
                          <td key={p.id} className="px-3 py-2 text-center text-xs text-slate-300" title={`${s.name} doesn't take this subject`}>
                            N/A
                          </td>
                        );
                      }
                      const v = values[k] ?? "";
                      const parsed = parseMark(v, p.maxMarks);
                      const low = "marks" in parsed && (parsed.marks / p.maxMarks) * 100 < PASS_PERCENT;
                      if (!p.editable || locked) {
                        return (
                          <td key={p.id} className={`px-3 py-2 text-center tabular-nums ${v === "AB" ? "font-medium text-rose-600" : low ? "text-rose-600" : "text-slate-700"}`}>
                            {v || <span className="text-slate-300">—</span>}
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
                            className={`w-16 rounded-md border px-2 py-1.5 text-center tabular-nums outline-none transition focus:ring-4 ${
                              err || "error" in parsed
                                ? "border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-500/10"
                                : v === "AB"
                                  ? "border-rose-200 bg-rose-50/50 font-medium text-rose-600 focus:border-indigo-500 focus:ring-indigo-500/10"
                                  : `border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10 ${low ? "text-rose-600" : "text-slate-900"} ${(saved[k] ?? "") !== v ? "bg-amber-50" : "bg-white"}`
                            }`}
                          />
                          {(err || "error" in parsed) && <p className="mt-0.5 text-[11px] leading-tight text-rose-600">{err ?? ("error" in parsed ? parsed.error : "")}</p>}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                      {t.max ? (
                        <>
                          <span className="font-semibold text-slate-900">{formatMarks(t.got)}</span>
                          <span className="text-slate-400">/{t.max}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 pr-6 text-right tabular-nums">
                      {t.complete && t.max ? (
                        <span className={t.failed ? "text-rose-600" : "text-slate-900"}>
                          {t.percent.toFixed(1)} <span className="text-xs text-slate-400">{gradeFor(t.percent)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
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
      <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1 space-y-2">
          <FormMessage state={dirty && state.ok ? {} : state} />
          <FormMessage state={publishState} />
          {!locked && papers.some((p) => p.editable) && (
            <p className="text-xs text-slate-500">Type marks, or AB for absent. Enter moves down. Marks below {PASS_PERCENT}% show in red.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!locked && papers.some((p) => p.editable) && (
            <button type="button" onClick={submit} disabled={saving || !dirty} className={buttonVariants.primary}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : dirty ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Saved"}
            </button>
          )}
          {data.canPublish &&
            (locked ? (
              <button
                type="button"
                disabled={publishing}
                onClick={() => {
                  if (!window.confirm("Unpublish these results? Marks become editable again.")) return;
                  startPublishing(async () => setPublishState(await unpublish()));
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
                onClick={() => {
                  if (!window.confirm(`Publish results for ${data.section.label}? Marks will be locked.`)) return;
                  startPublishing(async () => setPublishState(await publish()));
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
    <span className="flex items-center gap-2 text-xs text-slate-600">
      {label}
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}
