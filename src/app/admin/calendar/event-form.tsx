"use client";

import Link from "next/link";
import { useState } from "react";
import { Paperclip, Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, FormActions, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { EVENT_META, EVENT_TYPES } from "@/lib/calendar-shared";

type Values = {
  type: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  classIds: string[];
  /** The saved attachment, if any. */
  attachment?: { name: string; href: string } | null;
};

/** Add or edit one calendar entry. Holidays are always for the whole school. */
export function EventForm({
  action,
  classes,
  values,
  minDate,
  maxDate,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  classes: { id: string; name: string }[];
  values?: Values;
  minDate: string;
  maxDate: string;
  submitLabel: string;
}) {
  const [type, setType] = useState(values?.type ?? "EVENT");
  const [scope, setScope] = useState(values?.classIds.length ? "some" : "all");
  const holiday = type === "HOLIDAY";

  return (
    <ActionForm action={action} className="space-y-6">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg-2">Type</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {EVENT_TYPES.map((t) => {
                  const meta = EVENT_META[t];
                  const Icon = meta.icon;
                  return (
                    <label
                      key={t}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm transition hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                    >
                      <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                      <Icon className="h-4 w-4 text-muted" aria-hidden />
                      <span className="truncate font-medium text-fg">{meta.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Title" name="title" errors={e} required className="sm:col-span-2">
                <input
                  name="title"
                  required
                  maxLength={80}
                  defaultValue={values?.title}
                  placeholder={holiday ? "e.g. Diwali break" : "e.g. Annual sports day"}
                  className={inputClass}
                />
              </Field>
              <Field label="From" name="startDate" errors={e} required>
                <input type="date" name="startDate" required min={minDate} max={maxDate} defaultValue={values?.startDate} className={inputClass} />
              </Field>
              <Field label="To" name="endDate" errors={e} hint="Leave blank for one day.">
                <input type="date" name="endDate" min={minDate} max={maxDate} defaultValue={values?.startDate === values?.endDate ? "" : values?.endDate} className={inputClass} />
              </Field>
              <Field label="Details" name="description" errors={e} className="sm:col-span-2 lg:col-span-4">
                <textarea name="description" rows={2} maxLength={300} defaultValue={values?.description} placeholder="Optional: timings, venue, what to bring…" className={inputClass} />
              </Field>
              <Field
                label={values?.attachment ? "Replace attachment" : "Attachment"}
                name="attachment"
                errors={e}
                hint="Optional. A circular, schedule or poster: PDF, PNG or JPG up to 4 MB."
                className="sm:col-span-2 lg:col-span-4"
              >
                <input type="file" name="attachment" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className={inputClass} />
              </Field>
              {values?.attachment && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm sm:col-span-2 lg:col-span-4">
                  <Paperclip className="h-4 w-4 text-subtle" />
                  <a href={values.attachment.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-accent-text hover:underline">
                    {values.attachment.name}
                  </a>
                  <label className="flex items-center gap-2 text-muted">
                    <input type="checkbox" name="removeAttachment" className={checkboxClass} />
                    Remove it
                  </label>
                </div>
              )}
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg-2">For</legend>
              {holiday ? (
                <p className="rounded-lg border border-dashed border-line bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
                  The whole school. Once published, these days become school holidays and no attendance is due (Sundays in a range are skipped).
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {[
                      ["all", "Whole school"],
                      ["some", "Selected classes"],
                    ].map(([v, label]) => (
                      <label key={v} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} className="accent-accent" />
                        {label}
                      </label>
                    ))}
                  </div>
                  {scope === "some" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {classes.map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft"
                        >
                          <input type="checkbox" name="classIds" value={c.id} defaultChecked={values?.classIds.includes(c.id)} className={checkboxClass} />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  )}
                  {e?.classIds?.[0] && <p className="mt-1.5 text-xs font-medium text-danger">{e.classIds[0]}</p>}
                </>
              )}
              {holiday && <input type="hidden" name="scope" value="all" />}
            </fieldset>

            <FormActions>
              <Link href="/admin/calendar" className={buttonVariants.secondary}>
                Cancel
              </Link>
              <SubmitButton icon={<Save className="h-4 w-4" />}>{submitLabel}</SubmitButton>
            </FormActions>
          </>
        );
      }}
    </ActionForm>
  );
}
