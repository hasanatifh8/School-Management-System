"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { Banknote, Building2, Check, CreditCard, FileCheck2, IndianRupee, Percent, QrCode, SlidersHorizontal, Wallet } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Button, SegmentedControl, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, allocatePayment, monthLabel, quickAmounts, rupees, type DueItem } from "@/lib/fees-shared";

const MODE_ICONS = { CASH: Banknote, UPI: QrCode, CARD: CreditCard, CHEQUE: FileCheck2, BANK_TRANSFER: Building2, OTHER: Wallet };
const NEEDS_REF = new Set(["CHEQUE", "UPI", "BANK_TRANSFER"]);

/**
 * One-step collection: choose or type the amount received; it is applied to
 * the oldest dues first, with a plain preview of what it covers.
 */
export function DeskCollect({
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
  const [date, setDate] = useState(today);
  const quick = useMemo(() => quickAmounts(dues, date), [dues, date]);
  const [amountText, setAmountText] = useState(() => String(quick.dueNow || ""));
  const [waiveLate, setWaiveLate] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountText, setDiscountText] = useState("");
  const [more, setMore] = useState(false);
  const [mode, setMode] = useState("CASH");
  const [state, formAction, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);

  const amount = Number(amountText) || 0;
  const discount = discountOpen ? Number(discountText) || 0 : 0;
  const plan = useMemo(() => allocatePayment(dues, { amount, discount, waiveLate, payDate: date }), [dues, amount, discount, waiveLate, date]);
  const lateOwed = useMemo(() => dues.filter((d) => d.balance > 0 && date > d.lateAfter).reduce((n, d) => n + d.lateFeeRate, 0), [dues, date]);
  const leftAfter = Math.max(0, quick.session - plan.total - (discount - plan.unusedDiscount) - plan.lateWaived);

  // What the payment covers, month by month.
  const months = useMemo(() => {
    const map = new Map<string, { label: string; parts: { name: string; amount: number; late: number; full: boolean; discount: number }[] }>();
    for (const l of plan.lines) {
      const k = l.item.arrears ? `a:${l.item.due}` : l.item.due.slice(0, 7);
      const label = l.item.arrears ? `${monthLabel(l.item.due.slice(0, 7))} · ${l.item.arrears} arrears` : monthLabel(l.item.due.slice(0, 7));
      const row = map.get(k) ?? { label, parts: [] };
      row.parts.push({ name: l.item.headName, amount: l.amount, late: l.lateFee, full: l.full, discount: l.discount });
      map.set(k, row);
    }
    return [...map.values()];
  }, [plan]);

  const choices = [
    { key: "due", label: "Due now", value: quick.dueNow },
    { key: "month", label: `Up to ${monthLabel(date.slice(0, 7)).split(" ")[0]}`, value: quick.upToMonth },
    { key: "all", label: "Full session", value: quick.session },
  ].filter((c, i, all) => c.value > 0 && all.findIndex((x) => x.value === c.value) === i);

  if (quick.session === 0) {
    return (
      <div className="rounded-2xl border border-success-line bg-success-soft px-5 py-6 text-center">
        <Check className="mx-auto h-8 w-8 text-success" />
        <p className="mt-2 font-semibold text-fg">All paid up</p>
        <p className="text-sm text-muted">Nothing is owed for this session.</p>
      </div>
    );
  }

  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          form.current?.requestSubmit();
        }
      }}
      className="overflow-clip rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="space-y-5 p-4 sm:p-6">
        {/* 1. How much */}
        <div>
          <p className="mb-2 text-sm font-medium text-fg-2">Amount received</p>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {choices.map((c) => {
              const on = amount === c.value;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setAmountText(String(c.value))}
                  aria-pressed={on}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${on ? "border-accent bg-accent-soft ring-2 ring-accent/20" : "border-line hover:border-accent-line hover:bg-surface-2"}`}
                >
                  <span className="block text-xs text-muted">{c.label}</span>
                  <span className="block text-lg font-semibold tabular-nums text-fg">{rupees(c.value)}</span>
                </button>
              );
            })}
          </div>
          <label className="relative block">
            <IndianRupee className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" />
            <input
              name="amount"
              inputMode="numeric"
              autoFocus
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
              aria-label="Amount received in rupees"
              className="h-14 w-full rounded-xl border border-line-strong bg-surface pl-11 pr-4 text-2xl font-semibold tabular-nums text-fg focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
            />
          </label>
        </div>

        {/* 2. What it covers */}
        <div className="rounded-xl bg-surface-2/70 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">This payment covers</p>
          {months.length === 0 ? (
            <p className="text-sm text-muted">Enter an amount to see which fees it pays.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {months.map((m) => (
                <li key={m.label} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-40 shrink-0 font-medium text-fg">{m.label}</span>
                  <span className="min-w-0 flex-1 text-fg-2">
                    {m.parts.map((p, i) => (
                      <span key={i} className="mr-3 inline-flex items-center gap-1 whitespace-nowrap">
                        {p.full ? <Check className="h-3.5 w-3.5 text-success" /> : <span className="rounded bg-warning-soft px-1 text-[10px] font-semibold uppercase text-warning">part</span>}
                        {p.name} {rupees(p.amount)}
                        {p.late > 0 && <span className="text-danger">+{rupees(p.late)} late</span>}
                        {p.discount > 0 && <span className="text-success">−{rupees(p.discount)}</span>}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {plan.excess > 0 && <p className="mt-2 text-sm font-medium text-danger">{rupees(plan.excess)} more than everything owed this session.</p>}
          {plan.unusedDiscount > 0 && <p className="mt-2 text-sm font-medium text-danger">The discount is {rupees(plan.unusedDiscount)} more than the fees covered.</p>}
          {months.length > 0 && !plan.excess && (
            <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
              Still owed for the session after this: <span className="font-semibold text-fg">{rupees(leftAfter)}</span>
            </p>
          )}
        </div>

        {/* 3. Late fee and discount */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          {lateOwed > 0 && (
            <label className="flex items-center gap-2 text-fg-2">
              <input type="checkbox" name="waiveLate" checked={waiveLate} onChange={(e) => setWaiveLate(e.target.checked)} className={checkboxClass} />
              Waive late fee ({rupees(lateOwed)})
            </label>
          )}
          {!discountOpen ? (
            <button type="button" onClick={() => setDiscountOpen(true)} className="inline-flex items-center gap-1.5 font-medium text-accent-text hover:underline">
              <Percent className="h-3.5 w-3.5" /> Add discount
            </button>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-fg-2">
                Discount ₹
                <input
                  name="discount"
                  inputMode="numeric"
                  autoFocus
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                  className="h-9 w-24 rounded-lg border border-line-strong bg-surface px-2 text-right tabular-nums text-success focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
                />
              </label>
              <input name="discountNote" required={discount > 0} maxLength={200} placeholder="Reason, e.g. sibling discount" className={`${inputClass} !h-9 min-w-48 flex-1 !py-1.5`} />
              <button
                type="button"
                onClick={() => {
                  setDiscountOpen(false);
                  setDiscountText("");
                }}
                className="text-xs text-muted hover:text-fg"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* 4. How it was paid */}
        <div className="space-y-3">
          <SegmentedControl
            name="mode"
            label="Paid by"
            value={mode}
            onChange={setMode}
            className="flex-wrap"
            options={PAYMENT_MODES.map((m) => ({ value: m, label: MODE_LABELS[m], icon: MODE_ICONS[m] }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            {NEEDS_REF.has(mode) && (
              <input
                name="reference"
                required
                maxLength={60}
                placeholder={mode === "CHEQUE" ? "Cheque number" : mode === "UPI" ? "UPI reference" : "Transaction number"}
                className={`${inputClass} !h-10 max-w-xs`}
              />
            )}
            <button type="button" onClick={() => setMore((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {more ? "Fewer options" : date !== today ? `Paid on ${date} · more` : "Date, remarks"}
            </button>
          </div>
          {more ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-fg-2">
                Payment date
                <input type="date" name="date" value={date} min={minDate} max={today} onChange={(e) => setDate(e.target.value || today)} className={`${inputClass} mt-1`} />
              </label>
              <label className="text-sm text-fg-2">
                Remarks
                <input name="remarks" maxLength={200} className={`${inputClass} mt-1`} />
              </label>
            </div>
          ) : (
            <input type="hidden" name="date" value={date} />
          )}
        </div>
        <FormMessage state={state} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3 sm:px-6">
        <p className="text-xs text-muted">
          {plan.lateWaived > 0 && <span className="mr-2 text-danger">Late fee {rupees(plan.lateWaived)} waived</span>}
          Ctrl + Enter to collect
        </p>
        <Button type="submit" size="lg" loading={pending} icon={IndianRupee} disabled={(amount <= 0 && discount <= 0) || plan.excess > 0 || plan.unusedDiscount > 0}>
          Collect {rupees(plan.total)}
        </Button>
      </div>
    </form>
  );
}
