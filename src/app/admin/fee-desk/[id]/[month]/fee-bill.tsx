"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { Banknote, BadgeMinus, Building2, CreditCard, FileCheck2, GraduationCap, IndianRupee, Printer, QrCode, Wallet } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Button, SegmentedControl, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, dueKey, finesIn, payBill, rupees, type BillFine, type DueItem } from "@/lib/fees-shared";

const MODE_ICONS = { CASH: Banknote, UPI: QrCode, CARD: CreditCard, CHEQUE: FileCheck2, BANK_TRANSFER: Building2, OTHER: Wallet };
const NEEDS_REF = new Set(["CHEQUE", "UPI", "BANK_TRANSFER"]);

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

export type BillData = {
  school: { name: string; address: string | null; phone: string | null; logoUrl: string | null };
  student: { name: string; className: string; code: string; father: string; roll: string; active: boolean };
  /** All the student's instalments: a month's late fees can be on an earlier month's fee still unpaid then. */
  dues: DueItem[];
  month: { key: string; label: string; items: DueItem[]; charged: number; balance: number; late: number; lateFee: { charged: number; paid: number; waived: number } };
  /** Balances of part-paid earlier months, collected on this bill as previous dues. */
  carried: { key: string; label: string; items: DueItem[]; balance: number; late: number }[];
  /** This month was part paid; what is left is collected on that month's bill. */
  movedTo: { key: string; label: string } | null;
  /** Where a part payment's remainder would go: the next month with fees. */
  nextBill: { key: string; label: string } | null;
  /** Receipts that paid this month's fees: how much of each went to them, the later bill it was collected at (an add-on receipt), and whether it cleared the month. */
  receipts: { id: string; number: string; date: string; mode: string; amount: number; onBill: string | null; cleared: boolean; waiver: boolean }[];
};

/**
 * A month's fee bill that reads like the receipt it becomes: the month's fees,
 * any previous dues carried in from a part-paid month (ticked and settled
 * first, each on its own receipt for that month), the late fees charged in this
 * month (on its fees, or on an earlier fee still unpaid now; tick or untick
 * each; never a later month's), and the total; underneath, the
 * amount received (less is a part payment: what is left, late fee included,
 * moves to the next bill), how it was paid and Collect. Admins can also waive
 * the previous dues, with a reason.
 */
export function FeeBill({
  data,
  today,
  minDate,
  action,
  waive,
}: {
  data: BillData;
  today: string;
  minDate: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Admins only: writes off the previous dues on this bill. */
  waive?: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const { school, student, dues, month, carried, movedTo, nextBill, receipts } = data;
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState("CASH");
  const [discountText, setDiscountText] = useState("");
  const [extras, setExtras] = useState(false);
  const [lateChoice, setLateChoice] = useState<Record<string, boolean>>({});
  const [receivedText, setReceivedText] = useState("");
  // With previous dues on the bill, the month's own fees can be left for later.
  const [own, setOwn] = useState(true);
  const [state, formAction, pending] = useActionState(action, {});

  const withOwn = own || !carried.length;
  // The late fees on this bill, as of the payment date: each carried month's, then this month's (only its own).
  const finesOf = useMemo(() => new Map([...carried.map((c) => c.key), month.key].map((k) => [k, finesIn(dues, k, date)])), [dues, carried, month.key, date]);
  // Ticks: new late fees on every month of the bill; a fixed one only on this month's (earlier months' are previous dues).
  const tickable = useMemo(
    () => [...carried.flatMap((c) => finesOf.get(c.key)!.filter((f) => !f.fixed)), ...(withOwn ? finesOf.get(month.key)! : [])],
    [carried, finesOf, month.key, withOwn],
  );
  const isOn = (f: { key: string; onByDefault: boolean }) => lateChoice[f.key] ?? f.onByDefault;
  const discount = Number(discountText) || 0;
  const received = receivedText ? Number(receivedText) : undefined;
  const plan = useMemo(
    () => payBill(dues, { carried: carried.map((c) => c.key), month: month.key }, { own: withOwn, discount, lateChoice, received, payDate: date }),
    [dues, carried, month.key, withOwn, discount, lateChoice, received, date],
  );
  const part = received != null && received > 0 && received < plan.full;
  // The receipts this collection makes: an add-on one per earlier month, then the month's own.
  const receiptsMade = plan.parts.map((p) => ({ month: p.month, total: p.total, cleared: p.total === p.full, label: p.month === month.key ? month.label : (carried.find((c) => c.key === p.month)?.label ?? p.month) }));
  const ownOwing = month.balance + month.late > 0;
  const paid = month.items.length > 0 && !ownOwing && carried.length === 0;
  const waivedOff = paid && (month.items.some((d) => d.waived > 0) || month.lateFee.waived > 0);
  // The receipt that settled the month: the last one that cleared any of its fees.
  const closing = receipts.findLast((r) => r.cleared);
  const discounted = month.items.reduce((n, d) => n + d.discount, 0);
  // Paid towards this month so far: its fees and its late fees.
  const paidSoFar = month.items.reduce((n, d) => n + d.paid, 0) + month.lateFee.paid;
  // This month's late fee now: fixed earlier and still owed, plus new, as ticked.
  const lateNow = withOwn ? finesOf.get(month.key)!.reduce((n, f) => n + (isOn(f) ? f.amount : 0), 0) : 0;
  const canCollect = student.active && (carried.length > 0 || ownOwing) && !movedTo;
  // An earlier fee fined in this month says so: "on Aug 2026 Tuition".
  const fineName = (f: BillFine) => (f.own ? f.item.headName : `${f.item.headName} · ${f.item.label} fee, still unpaid in ${f.label.split(" ")[0]}`);

  return (
    <div className="space-y-4">
      <article className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {paid && (
          <span className="pointer-events-none absolute right-6 top-24 -rotate-12 rounded-lg border-4 border-success/60 px-4 py-1 text-3xl font-black uppercase tracking-widest text-success/60">
            {waivedOff ? "Waived" : "Paid"}
          </span>
        )}
        <header className="flex items-start gap-4 border-b border-line px-6 py-5">
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="" className="h-12 w-12 object-contain" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
              <GraduationCap className="h-6 w-6 text-muted" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-fg">{school.name}</p>
            {school.address && <p className="text-xs text-muted">{school.address}</p>}
            {school.phone && <p className="text-xs text-muted">Phone {school.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Fee bill</p>
            <p className="text-lg font-semibold text-fg">{month.label}</p>
            {month.items[0] && <p className="text-xs text-muted">Due by {day(month.items.map((d) => d.due).sort()[0])}</p>}
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-line px-6 py-4 text-sm sm:grid-cols-3">
          <Info label="Student" value={student.name} />
          <Info label="Class" value={student.className} />
          <Info label="Student ID" value={student.code} mono />
          <Info label="Father's name" value={student.father} />
          <Info label="Roll no." value={student.roll} />
          <Info label="Date" value={day(date)} />
        </dl>

        <div className="px-6 py-4">
          {month.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No fees are charged for {month.label}.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wider text-muted">
                    <th className="pb-2 font-medium">Fee</th>
                    <th className="pb-2 font-medium">Due date</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {month.items.map((d) => (
                    <tr key={dueKey(d.headId, d.period)} className="border-b border-line/60">
                      <td className="py-2.5 text-fg">{d.headName}</td>
                      <td className="py-2.5 text-muted">{day(d.due)}</td>
                      <td className="py-2.5 text-right tabular-nums text-fg">{rupees(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {carried.length > 0 && (
                <fieldset className="mt-4">
                  <legend className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">Previous dues · settled first, each on its own receipt</legend>
                  <ul className="divide-y divide-line/60 rounded-xl border border-warning-line bg-warning-soft/30">
                    {carried.map((c) => (
                      <li key={c.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {/* Always collected (or waived) before this month's fees, so it can't be unticked. */}
                        <input type="checkbox" checked disabled aria-label={`Previous due, ${c.label}`} className={checkboxClass} />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-fg">Previous due · {c.label}</span>
                          <span className="block text-xs text-muted">
                            {[
                              ...c.items.filter((d) => d.balance > 0).map((d) => `${d.headName} ${rupees(d.balance)}`),
                              ...finesOf
                                .get(c.key)!
                                .filter((f) => f.fixed)
                                .map((f) => `${c.label.split(" ")[0]} late fee${f.own ? ` (${f.item.headName})` : ` on ${f.item.label} ${f.item.headName}`} ${rupees(f.amount)}`),
                            ].join(", ")}{" "}
                            · left by a part payment
                          </span>
                        </span>
                        <span className="tabular-nums font-medium text-fg">{rupees(c.balance)}</span>
                      </li>
                    ))}
                    {ownOwing && (
                      <li>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition hover:bg-surface-2">
                          <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} className={checkboxClass} />
                          <span className={`min-w-0 flex-1 ${own ? "text-fg" : "text-muted line-through"}`}>
                            {month.label} fees <span className="text-xs text-muted">· collected after the previous dues are cleared</span>
                          </span>
                          <span className={`tabular-nums ${own ? "text-fg" : "text-subtle line-through"}`}>{rupees(month.balance + month.late)}</span>
                        </label>
                      </li>
                    )}
                  </ul>
                </fieldset>
              )}

              {/* Late fees charged in this bill's months, each can be ticked off; a later month's never shows here */}
              {tickable.length > 0 && (
                <fieldset className="mt-4">
                  <legend className="mb-1 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-muted">
                    <span>Late fee</span>
                    <span className="flex gap-3 normal-case tracking-normal">
                      <button type="button" onClick={() => setLateChoice(Object.fromEntries(tickable.map((f) => [f.key, true])))} className="font-medium text-accent-text hover:underline">
                        All
                      </button>
                      <button type="button" onClick={() => setLateChoice(Object.fromEntries(tickable.map((f) => [f.key, false])))} className="font-medium text-accent-text hover:underline">
                        None
                      </button>
                    </span>
                  </legend>
                  <ul className="divide-y divide-line/60 rounded-xl border border-line">
                    {tickable.map((f) => (
                      <li key={f.key}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition hover:bg-surface-2">
                          <input type="checkbox" checked={isOn(f)} onChange={(e) => setLateChoice((c) => ({ ...c, [f.key]: e.target.checked }))} className={checkboxClass} />
                          <span className={`min-w-0 flex-1 ${isOn(f) ? "text-fg" : "text-muted line-through"}`}>
                            {f.label} <span className="text-muted">· {fineName(f)}</span>
                            {f.fixed && <span className="ml-1 text-xs text-muted">(fixed earlier)</span>}
                            {f.beforeAdmission && <span className="ml-1 text-xs text-muted">(before admission)</span>}
                          </span>
                          <span className={`tabular-nums ${isOn(f) ? "text-danger" : "text-subtle line-through"}`}>{rupees(f.amount)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}

              <div className="mt-4 space-y-1.5 text-sm">
                {(discounted > 0 || discount > 0 || paidSoFar > 0 || carried.length > 0 || month.lateFee.charged > 0 || lateNow > 0) && <Row label="Fees" value={rupees(month.charged)} />}
                {discounted > 0 && <Row label={month.items.some((d) => d.waived > 0) ? "Discount / waived" : "Discount"} value={`− ${rupees(discounted)}`} tone="text-success" />}
                {/* This month's late fee: what earlier payments fixed (paid or written off), then what is owed now. */}
                {month.lateFee.paid > 0 && <Row label="Late fee (paid)" value={rupees(month.lateFee.paid)} tone="text-danger" />}
                {month.lateFee.waived > 0 && <Row label="Late fee waived" value={`${rupees(month.lateFee.waived)}`} tone="text-success" />}
                {!paid && paidSoFar > 0 && <Row label="Paid so far" value={`− ${rupees(paidSoFar)}`} tone="text-success" />}
                {movedTo && <Row label={`Moved to ${movedTo.label} bill`} value={`− ${rupees(month.balance + month.late)}`} tone="text-muted" />}
                {plan.previous > 0 && <Row label="Previous dues" value={rupees(plan.previous)} />}
                {!paid && !movedTo && lateNow > 0 && <Row label={`Late fee (${month.label.split(" ")[0]})`} value={rupees(lateNow)} tone="text-danger" />}
                {!paid && discount > 0 && <Row label="Discount now" value={`− ${rupees(discount - plan.unusedDiscount)}`} tone="text-success" />}
                <div className="flex items-baseline justify-between border-t-2 border-fg/80 pt-3">
                  <span className="font-semibold text-fg">{paid ? "Paid in full" : movedTo ? "Left on this bill" : "Total payable"}</span>
                  <span className={`text-2xl font-semibold tabular-nums ${paid ? "text-success" : "text-fg"}`}>{rupees(paid ? paidSoFar : movedTo ? 0 : plan.full)}</span>
                </div>
                {movedTo && (
                  <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                    Part paid. The {rupees(month.balance + month.late)} left is collected on the{" "}
                    <Link href={`./${movedTo.key}`} className="font-semibold underline">
                      {movedTo.label} bill
                    </Link>{" "}
                    as previous dues.
                  </p>
                )}
                {!paid && !movedTo && tickable.length === 0 && month.items.some((d) => d.balance > 0 && d.lateFeeRate > 0) && (
                  <p className="text-xs text-muted">
                    A late fee of {rupees(month.items.filter((d) => d.balance > 0).reduce((n, d) => n + d.lateFeeRate, 0))} applies if paid after{" "}
                    {day(month.items.filter((d) => d.balance > 0).map((d) => d.due).sort()[0])}
                    {month.items.some((d) => d.lateFeeMonthly) && ", and again in each later month it stays unpaid (on that month's bill)"}.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {receipts.length > 0 && (
          <footer className="border-t border-line bg-surface-2/60 px-6 py-3 text-sm">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{paid ? "Paid by" : "Payments so far"}</p>
            {/* When a later bill settled this month, say so: monthly totals stay traceable. */}
            {paid && closing && (
              <p className="mb-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                {waivedOff ? "Waived" : "Cleared"} on {day(closing.date)} by {closing.number}
                {closing.onBill ? `, collected with the ${closing.onBill} bill as previous dues` : ""}.
              </p>
            )}
            <ul className="space-y-1">
              {receipts.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3">
                  <Link href={`/admin/fees/receipts/${r.id}?from=desk`} className="font-mono font-medium text-accent-text hover:underline">
                    {r.number}
                  </Link>
                  <span className="text-muted">
                    {day(r.date)} · {r.mode}
                    {r.onBill && ` · add-on receipt, collected at the ${r.onBill} bill`}
                    {r.cleared && " · cleared it"}
                  </span>
                  <span className="tabular-nums font-medium text-fg">{rupees(r.amount)}</span>
                  <a href={`/admin/fees/receipts/${r.id}?print=1`} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        )}
      </article>

      {waive && student.active && carried.length > 0 && <WaiveDues month={month.key} total={carried.reduce((n, c) => n + c.balance + c.late, 0)} action={waive} />}

      {canCollect && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => formAction(new FormData(e.currentTarget)));
          }}
          className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6 print:hidden"
        >
          <input type="hidden" name="month" value={month.key} />
          <input type="hidden" name="date" value={date} />
          {own && <input type="hidden" name="own" value="on" />}
          {tickable.map((f) => (
            <input key={f.key} type="hidden" name={isOn(f) ? "lateOn" : "lateOff"} value={f.key} />
          ))}
          <SegmentedControl
            name="mode"
            label="Paid by"
            value={mode}
            onChange={setMode}
            className="flex-wrap"
            options={PAYMENT_MODES.map((m) => ({ value: m, label: MODE_LABELS[m], icon: MODE_ICONS[m] }))}
          />
          {NEEDS_REF.has(mode) && (
            <input
              name="reference"
              required
              maxLength={60}
              placeholder={mode === "CHEQUE" ? "Cheque number" : mode === "UPI" ? "UPI reference" : "Transaction number"}
              className={`${inputClass} mt-3 max-w-xs`}
            />
          )}

          <label className="mt-4 block max-w-xs text-sm text-fg-2">
            Amount received (₹)
            <input
              name="received"
              inputMode="numeric"
              value={receivedText}
              onChange={(e) => setReceivedText(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
              placeholder={String(plan.full)}
              className={`${inputClass} mt-1 text-lg font-semibold tabular-nums`}
            />
          </label>
          {part ? (
            <p className="mt-1.5 text-sm text-warning">
              Part payment: {rupees(plan.full - plan.total)} left
              {plan.total < plan.previous
                ? ". The previous dues are not cleared, so nothing goes to this month's fees yet."
                : nextBill
                  ? ` moves to the ${nextBill.label} bill as previous dues.`
                  : " stays due on this bill."}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted">Leave it for the full {rupees(plan.full)}, or enter less for a part payment.</p>
          )}
          {/* Previous dues are never mixed into the month's receipt: say which receipts this makes. */}
          {receiptsMade.length > 1 || (receiptsMade.length === 1 && receiptsMade[0].month !== month.key) ? (
            <ol className="mt-3 space-y-1 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-sm">
              {receiptsMade.map((r, i) => (
                <li key={r.month} className="flex justify-between gap-3">
                  <span className="text-muted">
                    Receipt {i + 1}: {r.month === month.key ? `${r.label} fees` : `previous due, ${r.label} (add-on receipt)`}
                    {r.cleared ? (r.month === month.key ? "" : " · clears it") : " · part"}
                  </span>
                  <span className="tabular-nums font-medium text-fg">{rupees(r.total)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {plan.excess > 0 && <p className="mt-1 text-sm text-danger">That is {rupees(plan.excess)} more than the bill.</p>}

          {extras ? (
            <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <label className="text-sm text-fg-2">
                Discount (₹)
                <input
                  name="discount"
                  inputMode="numeric"
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                  placeholder="0"
                  className={`${inputClass} mt-1 tabular-nums`}
                />
              </label>
              <label className="text-sm text-fg-2">
                Reason for discount
                <input name="discountNote" required={discount > 0} maxLength={200} placeholder="e.g. sibling discount" className={`${inputClass} mt-1`} />
              </label>
              <label className="text-sm text-fg-2">
                Payment date
                <input type="date" value={date} min={minDate} max={today} onChange={(e) => setDate(e.target.value || today)} className={`${inputClass} mt-1`} />
              </label>
              <label className="text-sm text-fg-2">
                Remarks
                <input name="remarks" maxLength={200} className={`${inputClass} mt-1`} />
              </label>
            </div>
          ) : (
            <button type="button" onClick={() => setExtras(true)} className="mt-3 text-sm font-medium text-accent-text hover:underline">
              Discount, payment date or remarks
            </button>
          )}

          <FormMessage state={state} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-muted">
              {plan.lateWaived > 0 && `Late fee ${rupees(plan.lateWaived)} waived`}
              {plan.unusedDiscount > 0 && <span className="block text-danger">The discount is more than this month&apos;s fees.</span>}
            </p>
            <Button type="submit" size="lg" loading={pending} icon={IndianRupee} disabled={plan.unusedDiscount > 0 || plan.excess > 0 || plan.parts.length === 0}>
              {`Collect ${rupees(plan.total)}${part ? " (part)" : ""}${receiptsMade.length > 1 ? ` · ${receiptsMade.length} receipts` : ""}`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Admins: write off the previous dues carried into this bill, with a reason; nothing is collected. */
function WaiveDues({ month, total, action }: { month: string; total: number; action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});
  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-card sm:px-6 print:hidden">
        <span className="text-muted">Previous dues of {rupees(total)} can be waived instead of collected.</span>
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-accent-text hover:underline">
          Waive previous dues
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
      className="space-y-3 rounded-2xl border border-warning-line bg-warning-soft/40 p-4 shadow-card sm:p-6 print:hidden"
    >
      <input type="hidden" name="month" value={month} />
      <p className="text-sm text-fg">
        Waive <b>{rupees(total)}</b> of previous dues (fees and late fees left by part payments). Nothing is collected; the earlier months are closed as waived. It is recorded with your name and the reason, and can be undone by cancelling the waiver.
      </p>
      <label className="block max-w-md text-sm text-fg-2">
        Reason
        <input name="reason" required minLength={3} maxLength={200} placeholder="e.g. hardship, approved by principal" className={`${inputClass} mt-1`} />
      </label>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" loading={pending} icon={BadgeMinus}>
          Waive {rupees(total)}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`truncate font-medium text-fg ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Row({ label, value, tone = "text-fg" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
