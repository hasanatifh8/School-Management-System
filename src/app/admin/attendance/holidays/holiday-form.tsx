"use client";

import { Plus } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/ui";
import { addSchoolHoliday } from "../actions";

export function HolidayForm({ min, max }: { min: string; max: string }) {
  return (
    <ActionForm action={addSchoolHoliday} className="space-y-4">
      {(state) => (
        <>
          <Field label="Holiday" name="name" errors={state.fieldErrors} required>
            <input name="name" maxLength={80} placeholder="e.g. Diwali break" className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" name="from" errors={state.fieldErrors} required>
              <input type="date" name="from" min={min} max={max} className={inputClass} />
            </Field>
            <Field label="To" name="to" errors={state.fieldErrors} hint="Leave empty for one day.">
              <input type="date" name="to" min={min} max={max} className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-slate-500">Sundays inside a range are skipped because they are already off.</p>
          <SubmitButton icon={<Plus className="h-4 w-4" />}>Add holiday</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
