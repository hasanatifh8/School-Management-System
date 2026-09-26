"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { Banknote, Building2, CreditCard, FileCheck2, IndianRupee, QrCode, Wallet } from "lucide-react";
import { Field, FormMessage } from "@/components/forms";
import { Badge, Button, SegmentedControl, SuccessState, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, dueKey, rupees, type DueItem } from "@/lib/fees-shared";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));

const MODE_ICONS = { CASH: Banknote, UPI: QrCode, CARD: CreditCard, CHEQUE: FileCheck2, BANK_TRANSFER: Building2, OTHER: Wallet };

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
      className="overflow-clip rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <h2 className="text-base font-semibold text-fg">Collect payment</h2>
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setSelected(new Set(open.filter((d) => d.due <= today).map((d) => dueKey(d.headId, d.period))))} className="font-medium text-accent-text underline-offset-4 hover:underline">
            Tick all due
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="font-medium text-muted hover:text-fg">
            Clear
          </button>
          {paidCount > 0 && (
            <button type="button" onClick={() => setShowPaid((v) => !v)} className="font-medium text-muted hover:text-fg">
              {showPaid ? "Hide paid" : `Show paid (${paidCount})`}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <SuccessState title="All paid up" description="Every fee for this session is paid." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-surface-2 text-left text-eyebrow uppercase text-muted">
              <tr>
                <th className="w-10 px-4 py-2.5 sm:px-6" />
                <th className="px-3 py-2.5">Fee</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
                <th className="px-3 py-2.5 pr-4 text-right sm:pr-6">Paying now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((d) => {
                const k = dueKey(d.headId, d.period);
                const on = selected.has(k);
                const payable = d.balance > 0;
                return (
                  <tr key={k} className={`transition-colors ${on ? "bg-accent-soft" : payable ? "" : "text-subtle"}`}>
                    <td className="px-4 py-2.5 sm:px-6">
                      {payable && <input type="checkbox" checked={on} onChange={() => toggle(k)} className={checkboxClass} aria-label={`Pay ${d.headName} ${d.label}`} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className={`font-medium ${payable ? "text-fg" : ""}`}>{d.headName}</p>
                      <p className="text-xs text-muted">{d.label}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="mr-2 text-xs text-muted">{fmt(d.due)}</span>
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
                          className="h-9 w-24 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm tabular-nums transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:bg-surface-2 disabled:text-subtle"
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
        <div className="space-y-4 border-t border-line px-4 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Payment date" name="date" errors={state.fieldErrors} required>
              <input type="date" name="date" defaultValue={today} min={minDate} max={today} required className={inputClass} />
            </Field>
            <fieldset className="sm:col-span-2 xl:col-span-4">
              <legend className="mb-1.5 block text-sm font-medium text-fg-2">
                Paid by<span className="ml-0.5 text-danger" aria-hidden>*</span>
              </legend>
              <SegmentedControl
                name="mode"
                label="Payment mode"
                value={mode}
                onChange={setMode}
                className="flex-wrap"
                options={PAYMENT_MODES.map((m) => ({ value: m, label: MODE_LABELS[m], icon: MODE_ICONS[m] }))}
              />
            </fieldset>
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
        </div>
      )}
      {open.length > 0 && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-4 rounded-b-2xl border-t border-line bg-glass px-4 py-4 backdrop-blur-xl sm:px-6 md:bottom-0">
          <div>
            <p className="text-eyebrow uppercase text-muted">Total</p>
            <p className="text-display-sm font-semibold tabular-nums text-fg">{rupees(total)}</p>
          </div>
          <Button type="submit" size="lg" loading={pending} icon={IndianRupee} disabled={total <= 0}>
            Collect & make receipt
          </Button>
        </div>
      )}
    </form>
  );
}
