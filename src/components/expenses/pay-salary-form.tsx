"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, rupees } from "@/lib/fees-shared";
import { dayCount } from "@/lib/payroll-shared";

/**
 * Pay one person's month. The amount starts at their net pay less loss of pay
 * for unpaid days; unticking "Deduct unpaid days" pays them in full.
 */
export function PaySalaryForm({
  action,
  net,
  lopDays,
  lopAmount,
  today,
  onSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  net: number | null;
  lopDays: number;
  lopAmount: number;
  today: string;
  /** Called once paid, e.g. to close the dialog. */
  onSuccess?: () => void;
}) {
  const [deduct, setDeduct] = useState(lopDays > 0);
  const [amount, setAmount] = useState(net == null ? "" : String(Math.max(0, net - (lopDays > 0 ? lopAmount : 0))));
  return (
    <ActionForm action={action} keepValues onSuccess={onSuccess} className="mt-2 space-y-2">
      {lopDays > 0 && net != null && (
        <label className="flex w-fit items-center gap-2 rounded-lg bg-danger-soft/60 px-3 py-1.5 text-xs text-fg-2">
          <input
            type="checkbox"
            name="deductLop"
            checked={deduct}
            onChange={(e) => {
              setDeduct(e.target.checked);
              setAmount(String(Math.max(0, net - (e.target.checked ? lopAmount : 0))));
            }}
            className={checkboxClass}
          />
          Deduct {dayCount(lopDays)} unpaid ({rupees(lopAmount)})
        </label>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-2">Amount (₹)</span>
          <input name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} required className={`${inputClass} !w-32 !py-2 tabular-nums`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-2">Paid on</span>
          <input type="date" name="paidOn" defaultValue={today} max={today} required className={`${inputClass} !py-2`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-2">Mode</span>
          <select name="mode" defaultValue="BANK_TRANSFER" className={`${selectClass} !w-40 !py-2`}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-fg-2">Note</span>
          <input name="note" maxLength={200} placeholder="Optional, shown on the slip" className={`${inputClass} !py-2`} />
        </label>
        <SubmitButton size="sm">Mark paid</SubmitButton>
      </div>
    </ActionForm>
  );
}
