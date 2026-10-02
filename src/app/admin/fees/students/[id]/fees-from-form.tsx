"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { checkboxClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { monthLabel } from "@/lib/fees-shared";

/**
 * Where a mid-session admission's fees start: the admission month, or an
 * earlier month, and then which fees apply to the months before admission.
 */
export function FeesFromForm({
  action,
  months,
  admissionMonth,
  current,
  heads,
  picked,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  months: string[];
  admissionMonth: string;
  /** The saved month ("" = from admission). */
  current: string;
  /** Fees that could be charged for months before admission. */
  heads: { id: string; name: string }[];
  /** Saved choice; empty = all of them. */
  picked: string[];
}) {
  const [month, setMonth] = useState(current);
  const before = !!month && month < admissionMonth;
  return (
    <ActionForm action={action} compact keepValues className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Charge fees from
        <select name="feesFrom" value={month} onChange={(e) => setMonth(e.target.value)} className={`${selectClass} !w-52 !py-1.5`}>
          <option value="">Admission ({monthLabel(admissionMonth)})</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
              {m === months[0] ? " (whole session)" : ""}
            </option>
          ))}
        </select>
      </label>
      {before && heads.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm text-fg-2">
            Fees to charge for {monthLabel(month)} – {monthLabel(months[Math.max(0, months.indexOf(admissionMonth) - 1)])} (before admission)
          </legend>
          <div className="flex flex-wrap gap-2">
            {heads.map((h) => (
              <label key={h.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft">
                <input type="hidden" name="offered" value={h.id} />
                <input type="checkbox" name="backHeads" value={h.id} defaultChecked={!picked.length || picked.includes(h.id)} className={checkboxClass} />
                {h.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">From {monthLabel(admissionMonth)} on, every fee is charged as usual.</p>
        </fieldset>
      )}
      <SubmitButton variant="secondary" size="sm">
        Save
      </SubmitButton>
    </ActionForm>
  );
}
