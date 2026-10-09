"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Crown, Loader2 } from "lucide-react";
import { TeacherOptions, type TeacherChoice } from "@/components/teaching/teacher-options";
import { Badge, cx, selectClass, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type GridClass = {
  id: string;
  name: string;
  subjects: { id: string; name: string }[];
  sections: { id: string; name: string; classTeacherId: string | null; teachers: Record<string, string> }[];
};

type Save = (sectionId: string, subjectId: string | null, teacherId: string) => Promise<ActionState>;

/**
 * Every class's sections against its subjects: the class teacher and each
 * subject's teacher, chosen from a dropdown and saved straight away.
 * Unassigned cells stand out; filter by class or show only gaps.
 */
export function AssignGrid({ classes, teachers, save }: { classes: GridClass[]; teachers: TeacherChoice[]; save: Save }) {
  const [classId, setClassId] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  // Local copy, so a change shows at once (and is undone if saving fails).
  const [state, setState] = useState(classes);
  const shown = useMemo(
    () =>
      state
        .filter((c) => !classId || c.id === classId)
        .map((c) => ({ ...c, sections: gapsOnly ? c.sections.filter((s) => !s.classTeacherId || c.subjects.some((sub) => !s.teachers[sub.id])) : c.sections }))
        .filter((c) => c.sections.length),
    [state, classId, gapsOnly],
  );
  const gaps = state.reduce((n, c) => n + c.sections.reduce((m, s) => m + (s.classTeacherId ? 0 : 1) + c.subjects.filter((sub) => !s.teachers[sub.id]).length, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class" className={`${selectClass} !h-9 !w-48 !py-1.5`}>
          <option value="">All classes</option>
          {state.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} className="h-4 w-4 accent-accent" />
          Only sections with gaps
        </label>
        <span className="ml-auto">
          {gaps ? (
            <Badge tone="amber" dot>
              {gaps} to assign
            </Badge>
          ) : (
            <Badge tone="green" dot>
              Everything assigned
            </Badge>
          )}
        </span>
      </div>

      {shown.length === 0 && <p className="rounded-2xl border border-dashed border-line px-6 py-8 text-center text-sm text-muted">Nothing to show.</p>}

      {shown.map((c) => (
        <section key={c.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-6">
            <Link href={`/admin/classes/${c.id}`} className="font-semibold text-fg hover:text-accent-text">
              {c.name}
            </Link>
            {c.subjects.length === 0 && (
              <Link href={`/admin/classes/${c.id}`} className="text-xs font-medium text-warning hover:underline">
                No subjects yet: set the curriculum
              </Link>
            )}
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left text-eyebrow uppercase text-muted">Section</th>
                  <th className="px-3 py-2 text-left text-eyebrow uppercase text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3.5 w-3.5 text-accent-text" /> Class teacher
                    </span>
                  </th>
                  {c.subjects.map((sub) => (
                    <th key={sub.id} className="px-3 py-2 text-left text-eyebrow uppercase text-muted">
                      {sub.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {c.sections.map((s) => (
                  <tr key={s.id}>
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-semibold text-fg">{s.name}</td>
                    <td className="px-3 py-2">
                      <Cell
                        value={s.classTeacherId ?? ""}
                        label={`Class teacher of ${c.name} ${s.name}`}
                        onSave={(teacherId) => save(s.id, null, teacherId)}
                        onLocal={(v) => setState((st) => patch(st, c.id, s.id, (sec) => ({ ...sec, classTeacherId: v || null })))}
                      >
                        <TeacherOptions teachers={teachers} forSection={s.id} empty="— None —" />
                      </Cell>
                    </td>
                    {c.subjects.map((sub) => (
                      <td key={sub.id} className="px-3 py-2">
                        <Cell
                          value={s.teachers[sub.id] ?? ""}
                          label={`${sub.name} teacher of ${c.name} ${s.name}`}
                          onSave={(teacherId) => save(s.id, sub.id, teacherId)}
                          onLocal={(v) => setState((st) => patch(st, c.id, s.id, (sec) => ({ ...sec, teachers: { ...sec.teachers, [sub.id]: v } })))}
                        >
                          <TeacherOptions teachers={teachers} subject={sub} empty="— None —" />
                        </Cell>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function patch(classes: GridClass[], classId: string, sectionId: string, f: (s: GridClass["sections"][number]) => GridClass["sections"][number]) {
  return classes.map((c) => (c.id !== classId ? c : { ...c, sections: c.sections.map((s) => (s.id === sectionId ? f(s) : s)) }));
}

/** One teacher picker that saves as soon as it changes. */
function Cell({ value, label, onSave, onLocal, children }: { value: string; label: string; onSave: (teacherId: string) => Promise<ActionState>; onLocal: (v: string) => void; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <span className="relative flex items-center">
      <select
        value={value}
        aria-label={label}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const before = value;
          onLocal(next);
          start(async () => {
            const result = await onSave(next);
            if (result.error) {
              onLocal(before);
              toast({ title: result.error, tone: "error" });
            } else toast({ title: result.message ?? "Saved", tone: "success" });
          });
        }}
        className={cx(selectClass, "!h-9 min-w-44 !py-1 text-sm", !value && "!border-warning-line !bg-warning-soft/40")}
      >
        {children}
      </select>
      {pending && <Loader2 className="absolute -right-5 h-4 w-4 animate-spin text-muted" aria-hidden />}
    </span>
  );
}
