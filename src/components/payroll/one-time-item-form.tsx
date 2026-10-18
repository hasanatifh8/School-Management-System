"use client";

import { Plus } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/** Adds a one-time earning or deduction to one month's salary, for one person or a whole group. */
export function OneTimeItemForm({
  action,
  people,
  monthName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  people: { key: string; name: string; role: string; paid: boolean }[];
  monthName: string;
}) {
  const teachers = people.filter((p) => p.key.startsWith("T:"));
  const staff = people.filter((p) => p.key.startsWith("S:"));
  const option = (p: (typeof people)[number]) => (
    <option key={p.key} value={p.key} disabled={p.paid}>
      {p.name} · {p.role}
      {p.paid ? " (already paid)" : ""}
    </option>
  );
  return (
    <ActionForm action={action} className="space-y-4">
      {(state) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="For" name="target" errors={state.fieldErrors} required>
              <select name="target" required defaultValue="" className={selectClass}>
                <option value="" disabled>
                  Choose who
                </option>
                <optgroup label="Groups">
                  <option value="EVERYONE">Everyone (teachers and staff)</option>
                  <option value="TEACHERS">All teachers</option>
                  <option value="STAFF">All non-teaching staff</option>
                </optgroup>
                {teachers.length > 0 && <optgroup label="Teachers">{teachers.map(option)}</optgroup>}
                {staff.length > 0 && <optgroup label="Non-teaching staff">{staff.map(option)}</optgroup>}
              </select>
            </Field>
            <Field label="Name" name="name" errors={state.fieldErrors} required hint="Printed on the slip.">
              <input name="name" required maxLength={60} placeholder="e.g. Diwali bonus, Arrears, Advance recovery" className={inputClass} />
            </Field>
            <Field label="Type" name="kind" errors={state.fieldErrors} required>
              <select name="kind" defaultValue="EARNING" className={selectClass}>
                <option value="EARNING">Earning (adds to pay)</option>
                <option value="DEDUCTION">Deduction (takes off pay)</option>
              </select>
            </Field>
            <Field label="Amount (₹)" name="amount" errors={state.fieldErrors} required>
              <input name="amount" required inputMode="numeric" placeholder="e.g. 5000" className={inputClass} />
            </Field>
          </div>
          <Field label="Reason" name="note" errors={state.fieldErrors} hint="Why it's given or taken off. The employee sees this on the slip.">
            <input name="note" maxLength={160} placeholder="e.g. Festival bonus 2026, or Advance of 12 Sep repaid" className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">For {monthName} only. It&apos;s added when the salary is paid; people already paid are skipped.</p>
            <SubmitButton icon={<Plus className="h-4 w-4" />}>Add one-time item</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
