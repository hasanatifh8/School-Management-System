"use client";

import { useRef, useState } from "react";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { FREQUENCIES, FREQUENCY_META, MONTH_NAMES, type Frequency } from "@/lib/fees-shared";

type Head = { name: string; frequency: Frequency; optional: boolean; dueDay: number; dueMonth: number | null; amounts: Record<string, number> };

/** Add or edit a fee: name, how often, due day, and the amount for each class. */
export function FeeHeadForm({
  action,
  classes,
  head,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  classes: { id: string; name: string }[];
  head?: Head;
}) {
  const [frequency, setFrequency] = useState<Frequency>(head?.frequency ?? "MONTHLY");
  const [fill, setFill] = useState("");
  const amountsRef = useRef<HTMLDivElement>(null);
  const fillAll = () => {
    amountsRef.current?.querySelectorAll<HTMLInputElement>("input[name^='amount:']").forEach((i) => (i.value = fill));
  };

  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fee name" name="name" errors={e} required hint="e.g. Tuition fee, Admission fee, Transport, Annual charges">
                <input name="name" defaultValue={head?.name} maxLength={60} required className={inputClass} />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">How often is it charged?</legend>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {FREQUENCIES.map((f) => (
                  <label
                    key={f}
                    className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 text-sm transition hover:border-indigo-200 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60"
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={f}
                      checked={frequency === f}
                      onChange={() => setFrequency(f)}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{FREQUENCY_META[f].label}</span>
                      <span className="block text-xs text-slate-500">{FREQUENCY_META[f].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              {frequency === "YEARLY" && (
                <Field label="Due in" name="dueMonth" errors={e}>
                  <select name="dueMonth" defaultValue={head?.dueMonth ?? 4} className={selectClass}>
                    {[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((m) => (
                      <option key={m} value={m}>
                        {MONTH_NAMES[m - 1]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {frequency !== "ONE_TIME" && (
                <Field label="Due by day of the month" name="dueDay" errors={e} hint="After this day it shows as overdue.">
                  <input type="number" name="dueDay" min={1} max={28} defaultValue={head?.dueDay ?? 10} className={inputClass} />
                </Field>
              )}
              {frequency === "ONE_TIME" && <input type="hidden" name="dueDay" value={head?.dueDay ?? 10} />}
            </div>

            <label className="flex max-w-xl items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input type="checkbox" name="optional" defaultChecked={head?.optional} className={`${checkboxClass} mt-0.5`} />
              <span>
                <span className="block font-medium text-slate-900">Only for students who opt in</span>
                <span className="block text-xs text-slate-500">
                  For fees like transport or hostel. You add students to it from their fee page. Leave unticked to charge every student of the class.
                </span>
              </span>
            </label>

            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Amount per class (₹)</h3>
                  <p className="text-xs text-slate-500">
                    {frequency === "MONTHLY" ? "Per month." : frequency === "QUARTERLY" ? "Per quarter." : frequency === "HALF_YEARLY" ? "Per half-year." : "The full amount."}{" "}
                    Leave a class blank if this fee doesn&apos;t apply to it.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={fill}
                    onChange={(ev) => setFill(ev.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="Same for all"
                    aria-label="Amount for every class"
                    className={`${inputClass} !w-36 !py-2`}
                  />
                  <button type="button" onClick={fillAll} className={`${buttonVariants.secondary} !py-2`}>
                    Fill all classes
                  </button>
                </div>
              </div>
              {classes.length === 0 ? (
                <p className="text-sm text-amber-700">Create classes first.</p>
              ) : (
                <div ref={amountsRef} className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {classes.map((c) => (
                    <Field key={c.id} label={c.name} name={`amount:${c.id}`} errors={e}>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                        <input
                          name={`amount:${c.id}`}
                          inputMode="numeric"
                          defaultValue={head?.amounts[c.id] ?? ""}
                          className={`${inputClass} pl-7 tabular-nums`}
                        />
                      </div>
                    </Field>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-6">
              <SubmitButton icon={<Save className="h-4 w-4" />}>{head ? "Save changes" : "Add fee"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
