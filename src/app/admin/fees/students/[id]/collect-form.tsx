"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { IndianRupee, Loader2 } from "lucide-react";
import { Field, FormMessage } from "@/components/forms";
import { Badge, buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, dueKey, rupees, type DueItem } from "@/lib/fees-shared";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));

const STATUS = {
  PAID: { tone: "green", label: "Paid" },
  PARTIAL: { tone: "amber", label: "Part paid" },
  OVERDUE: { tone: "red", label: "Due" },
  UPCOMING: { tone: "slate", label: "Upcoming" },
} as const;

/**
 * Tick the instalments being paid (everything due up to today is ticked to
 * start with), adjust amounts for part payments, add payment details, collect.
 */
export function CollectForm({
  dues,
  today,
  minDate,
  action,
}: {
  dues: DueItem[];
  today: string;
  minDate: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const open = dues.filter((d) => d.balance > 0);
  const [selected, setSelected] = useState(() => new Set(open.filter((d) => d.due <= today).map((d) => dueKey(d.headId, d.period))));
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(open.map((d) => [dueKey(d.headId, d.period), String(d.balance)])));
  const [showPaid, setShowPaid] = useState(false);
  const [mode, setMode] = useState("CASH");
  const [state, formAction, pending] = useActionState(action, {});

  const total = useMemo(
    () => open.reduce((n, d) => (selected.has(dueKey(d.headId, d.period)) ? n + (Number(amounts[dueKey(d.headId, d.period)]) || 0) : n), 0),
    [open, selected, amounts],
  );
  const toggle = (k: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const rows = showPaid ? dues : open;
  const paidCount = dues.length - open.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
        <h2 className="text-[15px] font-semibold text-slate-900">Collect payment</h2>
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setSelected(new Set(open.filter((d) => d.due <= today).map((d) => dueKey(d.headId, d.period))))} className="font-medium text-indigo-600 hover:text-indigo-500">
            Tick all due
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="font-medium text-slate-500 hover:text-slate-800">
            Clear
          </button>
          {paidCount > 0 && (
            <button type="button" onClick={() => setShowPaid((v) => !v)} className="font-medium text-slate-500 hover:text-slate-800">
              {showPaid ? "Hide paid" : `Show paid (${paidCount})`}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-emerald-700">Nothing to pay. All fees for this session are paid.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-10 px-4 py-2.5 sm:px-6" />
                <th className="px-3 py-2.5">Fee</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
                <th className="px-3 py-2.5 pr-4 text-right sm:pr-6">Paying now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((d) => {
                const k = dueKey(d.headId, d.period);
                const on = selected.has(k);
                const payable = d.balance > 0;
                return (
                  <tr key={k} className={on ? "bg-indigo-50/40" : payable ? "" : "text-slate-400"}>
                    <td className="px-4 py-2.5 sm:px-6">
                      {payable && <input type="checkbox" checked={on} onChange={() => toggle(k)} className={checkboxClass} aria-label={`Pay ${d.headName} ${d.label}`} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className={`font-medium ${payable ? "text-slate-900" : ""}`}>{d.headName}</p>
                      <p className="text-xs text-slate-500">{d.label}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="mr-2 text-xs text-slate-500">{fmt(d.due)}</span>
                      <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{rupees(d.amount)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{rupees(d.balance)}</td>
                    <td className="px-3 py-2.5 pr-4 text-right sm:pr-6">
                      {payable && (
                        <input
                          name={`pay:${k}`}
                          disabled={!on}
                          inputMode="numeric"
                          value={amounts[k]}
                          onChange={(e) => setAmounts((a) => ({ ...a, [k]: e.target.value.replace(/[^\d]/g, "") }))}
                          aria-label={`Amount for ${d.headName} ${d.label}`}
                          className="h-8 w-24 rounded-md border border-slate-200 px-2 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-300"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Payment date" name="date" errors={state.fieldErrors} required>
              <input type="date" name="date" defaultValue={today} min={minDate} max={today} required className={inputClass} />
            </Field>
            <Field label="Paid by" name="mode" errors={state.fieldErrors} required>
              <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={selectClass}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={mode === "CHEQUE" ? "Cheque number" : mode === "UPI" ? "UPI reference" : mode === "CASH" ? "Reference (optional)" : "Transaction number"}
              name="reference"
              errors={state.fieldErrors}
              required={mode === "CHEQUE" || mode === "UPI" || mode === "BANK_TRANSFER"}
            >
              <input name="reference" maxLength={60} className={inputClass} />
            </Field>
            <Field label="Remarks" name="remarks" errors={state.fieldErrors}>
              <input name="remarks" maxLength={200} className={inputClass} />
            </Field>
          </div>
          <FormMessage state={state} />
          <div className="flex flex-wrap items-center justify-end gap-4">
            <p className="text-sm text-slate-600">
              Total <span className="ml-1 text-xl font-semibold tabular-nums text-slate-900">{rupees(total)}</span>
            </p>
            <button type="submit" disabled={pending || total <= 0} className={buttonVariants.primary}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
              {pending ? "Saving…" : `Collect ${rupees(total)} & make receipt`}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
