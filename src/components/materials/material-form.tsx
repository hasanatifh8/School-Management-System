"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { KIND_META, MATERIAL_KINDS, MAX_MATERIAL_LABEL, type MaterialKindKey, type MaterialTarget } from "@/lib/materials-shared";

/** Post study material: what it is, for which class (and section) and subject, and a file and/or a link. */
export function MaterialForm({ action, targets, today }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; targets: MaterialTarget[]; today: string }) {
  const [kind, setKind] = useState<MaterialKindKey>("NOTES");
  const [classId, setClassId] = useState(targets.length === 1 ? targets[0].classId : "");
  const target = targets.find((t) => t.classId === classId);
  const [sectionId, setSectionId] = useState(target && !target.wholeClass && target.sections.length === 1 ? target.sections[0].id : "");
  const section = target?.sections.find((s) => s.id === sectionId);
  const subjects = section ? section.subjects : (target?.subjects ?? []);

  if (!targets.length) return <p className="text-sm text-muted">You don&apos;t teach any class yet, so there is nowhere to post.</p>;

  return (
    <ActionForm action={action} className="space-y-4">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-fg-2">What is it?</legend>
              <input type="hidden" name="kind" value={kind} />
              <div className="flex flex-wrap gap-1.5">
                {MATERIAL_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${kind === k ? "bg-accent-soft text-accent-text ring-accent-line" : "bg-surface text-fg-2 ring-line hover:bg-surface-2"}`}
                  >
                    {KIND_META[k].label}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label="Title" name="title" errors={e} required>
              <input name="title" required maxLength={120} placeholder={kind === "ASSIGNMENT" ? "e.g. Fractions worksheet 3" : kind === "TEST_PAPER" ? "e.g. Unit test 2 (2025)" : "e.g. Chapter 4: Photosynthesis"} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Class" name="classId" errors={e} required>
                <select
                  name="classId"
                  required
                  value={classId}
                  onChange={(ev) => {
                    setClassId(ev.target.value);
                    const t = targets.find((x) => x.classId === ev.target.value);
                    setSectionId(t && !t.wholeClass && t.sections.length === 1 ? t.sections[0].id : "");
                  }}
                  className={selectClass}
                >
                  <option value="">Choose class</option>
                  {targets.map((t) => (
                    <option key={t.classId} value={t.classId}>
                      {t.className}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Section" name="sectionId" errors={e} required={!!target && !target.wholeClass}>
                <select name="sectionId" value={sectionId} onChange={(ev) => setSectionId(ev.target.value)} required={!!target && !target.wholeClass} disabled={!target} className={selectClass}>
                  {(!target || target.wholeClass) && <option value="">{target ? "All sections" : "—"}</option>}
                  {target && !target.wholeClass && target.sections.length > 1 && <option value="">Choose section</option>}
                  {target?.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `Section ${s.name}` : target.className}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subject" name="subjectId" errors={e}>
                <select name="subjectId" disabled={!target} className={selectClass} defaultValue="">
                  <option value="">{subjects.length ? "General / all subjects" : "—"}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description" name="description" errors={e} hint="Optional: what it covers, instructions, marks…">
              <textarea name="description" rows={3} maxLength={1000} className={inputClass} />
            </Field>
            {kind === "ASSIGNMENT" && (
              <Field label="Due date" name="dueDate" errors={e}>
                <input type="date" name="dueDate" min={today} className={`${inputClass} max-w-48`} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="File" name="file" errors={e} hint={`PDF, image, DOC or DOCX, up to ${MAX_MATERIAL_LABEL}.`}>
                <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className={`${inputClass} !py-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-accent-text`} />
              </Field>
              <Field label="Link" name="link" errors={e} hint="Optional, e.g. a video or website.">
                <input name="link" type="url" placeholder="https://" className={inputClass} />
              </Field>
            </div>
            <SubmitButton icon={<Upload className="h-4 w-4" />}>Post</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
