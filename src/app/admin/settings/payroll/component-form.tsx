"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { CALC_LABELS, looksLikeAbsence, type SalaryCalcKey, type SalaryKind } from "@/lib/payroll-shared";

/** Add or edit a salary component: name, earning or deduction, fixed or % of basic, and its default. */
export function SalaryComponentForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: { name: string; kind: SalaryKind; calc: SalaryCalcKey; defaultValue: number | null };
  submitLabel: string;
}) {
  const [calc, setCalc] = useState<SalaryCalcKey>(initial?.calc ?? "FIXED");
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<SalaryKind>(initial?.kind ?? "EARNING");
  const percent = calc === "PERCENT_OF_BASIC";
  return (
    <ActionForm
      action={action}
      keepValues={!!initial}
      // Adding: start the next one from blank.
      onSuccess={() => {
        if (initial) return;
        setName("");
        setKind("EARNING");
        setCalc("FIXED");
      }}
      className="space-y-4"
    >
      {(state) => (
        <>
          <Field label="Name" name="name" errors={state.fieldErrors} required>
            <input
              name="name"
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HRA, Provident fund"
              className={inputClass}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" name="kind" errors={state.fieldErrors}>
              <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as SalaryKind)} className={selectClass}>
                <option value="EARNING">Earning (adds to pay)</option>
                <option value="DEDUCTION">Deduction (taken off)</option>
              </select>
            </Field>
            <Field label="Worked out as" name="calc" errors={state.fieldErrors} hint={initial && initial.calc !== calc ? "Changing this clears people's own values for it." : undefined}>
              <select name="calc" value={calc} onChange={(e) => setCalc(e.target.value as SalaryCalcKey)} className={selectClass}>
                {(Object.keys(CALC_LABELS) as SalaryCalcKey[]).map((k) => (
                  <option key={k} value={k}>
                    {CALC_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
            {kind === "DEDUCTION" && looksLikeAbsence(name) && (
              <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning ring-1 ring-inset ring-warning-line">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This is taken off <strong>every month</strong>, whatever the attendance. To deduct for absences or extra leave, don&apos;t add a component: use
                  Settings → Payroll → <strong>Deduction for absent days</strong>.
                </span>
              </p>
            )}
          <Field
            label={percent ? "Default percent of basic" : "Default amount (₹ a month)"}
            name="defaultValue"
            errors={state.fieldErrors}
            hint="Applies to everyone unless their salary says otherwise. Leave blank to add it only for the people you choose."
          >
            <div className="relative max-w-48">
              <input
                name="defaultValue"
                inputMode="decimal"
                defaultValue={initial?.defaultValue ?? ""}
                placeholder={percent ? "e.g. 40" : "e.g. 1500"}
                className={`${inputClass} tabular-nums ${percent ? "pr-8" : "pl-7"}`}
              />
              <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-subtle ${percent ? "right-3" : "left-3"}`}>{percent ? "%" : "₹"}</span>
            </div>
          </Field>
          <SubmitButton>{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
