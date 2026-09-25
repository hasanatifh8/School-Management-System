"use client";

import { Plus } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass, selectClass } from "@/components/ui";
import { MODE_LABELS, PAYMENT_MODES } from "@/lib/fees-shared";
import { addExpense } from "../actions";

export function ExpenseForm({ categories, today, defaultCategory }: { categories: { id: string; name: string }[]; today: string; defaultCategory?: string }) {
  return (
    <ActionForm action={addExpense} className="space-y-3">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <Field label="Category" name="categoryId" errors={e} required>
              <select name="categoryId" defaultValue={defaultCategory ?? ""} required className={selectClass}>
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)" name="amount" errors={e} required>
                <input name="amount" inputMode="numeric" required className={inputClass} />
              </Field>
              <Field label="Date" name="date" errors={e} required>
                <input type="date" name="date" defaultValue={today} max={today} required className={inputClass} />
              </Field>
            </div>
            <Field label="Paid to" name="paidTo" errors={e}>
              <input name="paidTo" maxLength={100} placeholder="e.g. State Electricity Board" className={inputClass} />
            </Field>
            <Field label="What for" name="description" errors={e}>
              <input name="description" maxLength={300} placeholder="e.g. August bill, Annual Day decoration" className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paid by" name="mode" errors={e}>
                <select name="mode" defaultValue="CASH" className={selectClass}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reference" name="reference" errors={e}>
                <input name="reference" maxLength={60} placeholder="Bill / txn no." className={inputClass} />
              </Field>
            </div>
            <SubmitButton icon={<Plus className="h-4 w-4" />}>Add expense</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
