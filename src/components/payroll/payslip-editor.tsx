"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { buttonVariants, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, rupees } from "@/lib/fees-shared";
import { rupeesInWords, type SalaryKind, type SlipLine } from "@/lib/payroll-shared";

type Row = { key: string; name: string; kind: SalaryKind; amount: string; note: string };

/**
 * Edits a draft salary slip: earnings and deductions (each with the reason the
 * employee sees), unpaid days, when and how it was paid. Net pay is earnings
 * minus deductions and becomes the amount paid.
 */
export function PayslipEditor({
  action,
  lines,
  lopDays,
  paidOn,
  mode,
  note,
  today,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  lines: SlipLine[];
  lopDays: number | null;
  paidOn: string;
  mode: string;
  note: string | null;
  today: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    lines.map((l) => ({ key: crypto.randomUUID(), name: l.name, kind: l.kind, amount: String(l.amount), note: l.note ?? "" })),
  );
  const amountOf = (r: Row) => (/^\d+$/.test(r.amount.trim()) ? Number(r.amount) : 0);
  const gross = rows.filter((r) => r.kind === "EARNING").reduce((n, r) => n + amountOf(r), 0);
  const deductions = rows.filter((r) => r.kind === "DEDUCTION").reduce((n, r) => n + amountOf(r), 0);
  const net = gross - deductions;
  const set = (key: string, change: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const add = (kind: SalaryKind) => setRows((prev) => [...prev, { key: crypto.randomUUID(), name: "", kind, amount: "", note: "" }]);
  const payload = JSON.stringify(rows.map((r) => ({ name: r.name, kind: r.kind, amount: amountOf(r), note: r.note.trim() || undefined })));

  const section = (kind: SalaryKind, title: string) => {
    const list = rows.filter((r) => r.kind === kind);
    return (
      <fieldset className="rounded-xl border border-line">
        <legend className="ml-3 px-1 text-sm font-semibold text-fg">{title}</legend>
        <ul className="divide-y divide-line">
          {list.length === 0 && <li className="px-4 py-3 text-sm text-muted">None</li>}
          {list.map((r) => (
            <li key={r.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <input
                value={r.name}
                onChange={(e) => set(r.key, { name: e.target.value })}
                maxLength={60}
                placeholder="Name, e.g. HRA"
                aria-label="Line name"
                className={inputClass}
              />
              <input
                value={r.amount}
                onChange={(e) => set(r.key, { amount: e.target.value.replace(/[^\d]/g, "") })}
                inputMode="numeric"
                placeholder="₹"
                aria-label={`${r.name || "Line"} amount`}
                className={`${inputClass} text-right tabular-nums`}
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                className={`${buttonVariants.dangerGhost} !p-2`}
                aria-label={`Remove ${r.name || "line"}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <input
                value={r.note}
                onChange={(e) => set(r.key, { note: e.target.value })}
                maxLength={160}
                placeholder={kind === "DEDUCTION" ? "Why it's deducted, e.g. 12% of basic pay for PF" : "How it's worked out (optional)"}
                aria-label={`${r.name || "Line"} reason`}
                className={`${inputClass} text-xs sm:col-span-3`}
              />
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-4 py-2.5">
          <button type="button" onClick={() => add(kind)} className={`${buttonVariants.ghost} h-8 px-2.5 text-xs`}>
            <Plus className="h-3.5 w-3.5" /> Add {kind === "EARNING" ? "earning" : "deduction"}
          </button>
        </div>
      </fieldset>
    );
  };

  return (
    <ActionForm action={action} keepValues className="space-y-6">
      {(state) => (
        <>
          <input type="hidden" name="lines" value={payload} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {section("EARNING", "Earnings")}
            {section("DEDUCTION", "Deductions")}
          </div>

          <div className="grid gap-3 rounded-xl bg-surface-2 p-4 text-sm sm:grid-cols-3">
            <p>
              <span className="block text-xs text-muted">Gross earnings</span>
              <span className="font-semibold tabular-nums text-fg">{rupees(gross)}</span>
            </p>
            <p>
              <span className="block text-xs text-muted">Total deductions</span>
              <span className="font-semibold tabular-nums text-danger">{rupees(deductions)}</span>
            </p>
            <p>
              <span className="block text-xs text-muted">Net pay</span>
              <span className={`text-lg font-bold tabular-nums ${net < 0 ? "text-danger" : "text-success"}`}>{rupees(net)}</span>
              {net > 0 && <span className="block text-[11px] italic text-muted">{rupeesInWords(net)}</span>}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Unpaid days deducted" name="lopDays" errors={state.fieldErrors} hint="Shown on the slip. Change the Loss of pay line to match.">
              <input name="lopDays" type="number" min={0} max={31} step={0.5} defaultValue={lopDays ?? ""} placeholder="0" className={inputClass} />
            </Field>
            <Field label="Paid on" name="paidOn" errors={state.fieldErrors} required>
              <input name="paidOn" type="date" required max={today} defaultValue={paidOn} className={inputClass} />
            </Field>
            <Field label="Mode" name="mode" errors={state.fieldErrors} required>
              <select name="mode" defaultValue={mode} className={selectClass}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Note on the slip" name="note" errors={state.fieldErrors} hint="Optional. Printed at the bottom of the slip.">
            <textarea name="note" rows={2} maxLength={200} defaultValue={note ?? ""} className={inputClass} />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            <p className="mr-auto text-xs text-muted">The amount paid becomes the net pay. The slip stays a draft until you publish it.</p>
            <SubmitButton icon={<Save className="h-4 w-4" />}>Save slip</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
