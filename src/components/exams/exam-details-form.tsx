"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleAlert, Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type ClassOption = { id: string; name: string; sections: { id: string; name: string }[] };

/** Name, classes/sections and instructions of an exam or test. */
export function ExamDetailsForm({
  action,
  classes,
  defaults,
  kind,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  classes: ClassOption[];
  defaults?: { name: string; instructions: string | null; sectionIds: string[] };
  kind: "exam" | "test";
  submitLabel: string;
  cancelHref?: string;
}) {
  const [selected, setSelected] = useState(() => new Set(defaults?.sectionIds ?? []));
  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const allIds = classes.flatMap((c) => c.sections.map((s) => s.id));

  return (
    <ActionForm action={action} className="space-y-6">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <Field label={kind === "exam" ? "Exam name" : "Test name"} name="name" errors={e} required>
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={defaults?.name}
                placeholder={kind === "exam" ? "e.g. Half-yearly examination 2026" : "e.g. Unit test 2 – Fractions"}
                className={inputClass}
              />
            </Field>

            <fieldset>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <legend className="text-sm font-medium text-slate-700">
                  Classes & sections<span className="ml-0.5 text-rose-500">*</span>
                </legend>
                {allIds.length > 1 && (
                  <div className="flex gap-3 text-xs font-medium">
                    <button type="button" onClick={() => toggle(allIds, true)} className="text-indigo-600 hover:text-indigo-500">
                      Select all
                    </button>
                    <button type="button" onClick={() => toggle(allIds, false)} className="text-slate-500 hover:text-slate-800">
                      Clear
                    </button>
                  </div>
                )}
              </div>
              {classes.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  {kind === "exam" ? "Add classes first (Classes page)." : "You aren't assigned to any class or section yet."}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.map((c) => {
                    const ids = c.sections.map((s) => s.id);
                    const count = ids.filter((id) => selected.has(id)).length;
                    return (
                      <div
                        key={c.id}
                        className={`rounded-xl border p-3 transition ${count ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200"}`}
                      >
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
                          <input
                            type="checkbox"
                            checked={count === ids.length}
                            ref={(el) => {
                              if (el) el.indeterminate = count > 0 && count < ids.length;
                            }}
                            onChange={(ev) => toggle(ids, ev.target.checked)}
                            className={checkboxClass}
                          />
                          {c.name}
                        </label>
                        {c.sections.length > 1 && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-6">
                            {c.sections.map((s) => (
                              <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={selected.has(s.id)}
                                  onChange={(ev) => toggle([s.id], ev.target.checked)}
                                  className={checkboxClass}
                                />
                                {s.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {[...selected].map((id) => (
                <input key={id} type="hidden" name="sectionIds" value={id} />
              ))}
              {e?.sectionIds?.[0] && (
                <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600">
                  <CircleAlert className="h-3.5 w-3.5" />
                  {e.sectionIds[0]}
                </span>
              )}
            </fieldset>

            <Field
              label="Instructions"
              name="instructions"
              errors={e}
              hint="Printed under the timetable. One instruction per line."
            >
              <textarea
                name="instructions"
                rows={4}
                maxLength={2000}
                defaultValue={defaults?.instructions ?? ""}
                placeholder={"Reach school 30 minutes before the exam.\nBring your admit card and stationery.\nMobile phones are not allowed."}
                className={inputClass}
              />
            </Field>

            <div className="flex items-center justify-end gap-3">
              {cancelHref && (
                <Link href={cancelHref} className={buttonVariants.secondary}>
                  Cancel
                </Link>
              )}
              <SubmitButton icon={<Save className="h-4 w-4" />}>{submitLabel}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
