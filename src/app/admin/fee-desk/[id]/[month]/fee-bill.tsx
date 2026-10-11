"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { Banknote, BadgeMinus, Building2, CreditCard, FileCheck2, GraduationCap, IndianRupee, Printer, QrCode, Wallet } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Button, SegmentedControl, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, dueKey, isOwing, lateFeeMonths, lateFeeOwed, payMonths, rupees, type DueItem } from "@/lib/fees-shared";

const MODE_ICONS = { CASH: Banknote, UPI: QrCode, CARD: CreditCard, CHEQUE: FileCheck2, BANK_TRANSFER: Building2, OTHER: Wallet };
const NEEDS_REF = new Set(["CHEQUE", "UPI", "BANK_TRANSFER"]);

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

export type BillData = {
  school: { name: string; address: string | null; phone: string | null; logoUrl: string | null };
  student: { name: string; className: string; code: string; father: string; roll: string; active: boolean };
  month: { key: string; label: string; items: DueItem[]; charged: number; balance: number };
  /** Balances of part-paid earlier months, collected on this bill as previous dues. */
  carried: { key: string; label: string; items: DueItem[]; balance: number }[];
  /** This month was part paid; what is left is collected on that month's bill. */
  movedTo: { key: string; label: string } | null;
  /** Where a part payment's remainder would go: the next month with fees. */
  nextBill: { key: string; label: string } | null;
  /** Receipts that paid this month's fees: how much of each went to them, and the bill it was collected on when a later one. */
  receipts: { id: string; number: string; date: string; mode: string; amount: number; onBill: string | null; cleared: boolean }[];
};

/**
 * A month's fee bill that reads like the receipt it becomes: the month's fees,
 * any previous dues carried in from a part-paid month, one late fee per month
 * each fee has stayed unpaid (tick or untick each), and the total; underneath,
 * the amount received (less is a part payment: what is left, late fee
 * included, moves to the next bill), how it was paid and Collect. Admins can
 * also waive the previous dues, with a reason.
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
  const { school, student, month, carried, movedTo, nextBill, receipts } = data;
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState("CASH");
  const [discountText, setDiscountText] = useState("");
  const [extras, setExtras] = useState(false);
  const [lateChoice, setLateChoice] = useState<Record<string, boolean>>({});
  const [receivedText, setReceivedText] = useState("");
  const [state, formAction, pending] = useActionState(action, {});

  // What this bill collects: previous dues carried in, then the month's own fees.
  const billItems = useMemo(() => [...carried.flatMap((c) => c.items), ...month.items], [carried, month]);
  const billKeys = useMemo(() => [...carried.map((c) => c.key), month.key], [carried, month]);
  const unpaid = useMemo(() => billItems.filter(isOwing), [billItems]);
  const paid = month.items.length > 0 && month.balance === 0 && carried.length === 0;
  const waivedOff = paid && month.items.some((d) => d.waived > 0);
  // The receipt that settled the month: the last one that cleared any of its fees.
  const closing = receipts.findLast((r) => r.cleared);
  // Every month's late fee on each unpaid fee, up to the payment date.
  const lateMonths = useMemo(() => unpaid.flatMap((d) => lateFeeMonths(d, date).map((l) => ({ ...l, fee: d.headName }))), [unpaid, date]);
  const isOn = (l: { key: string; onByDefault: boolean }) => lateChoice[l.key] ?? l.onByDefault;
  const discount = Number(discountText) || 0;
  const received = receivedText ? Number(receivedText) : undefined;
  const plan = useMemo(() => payMonths(billItems, billKeys, { discount, lateChoice, received, payDate: date }), [billItems, billKeys, discount, lateChoice, received, date]);
  const part = received != null && received > 0 && received < plan.full;
  const carriedTotal = carried.reduce((n, c) => n + c.balance, 0);
  const lateCollected = month.items.reduce((n, d) => n + d.lateFeePaid, 0);
  // Late fee fixed on this month's fees by earlier payments, and what of it was waived since.
  const lateFixed = month.items.reduce((n, d) => n + d.lateCharged, 0);
  const lateWrittenOff = month.items.reduce((n, d) => n + d.lateCharged - d.lateFeePaid - d.lateLeft, 0);
  // Late fee for the months since: the bill's late fee less what was fixed earlier (in the dues above).
  const newLate = plan.late - unpaid.reduce((n, d) => n + d.lateLeft, 0);
  const discounted = month.items.reduce((n, d) => n + d.discount, 0);
  const paidSoFar = month.items.reduce((n, d) => n + d.paid + d.lateFeePaid, 0);
  const canCollect = student.active && unpaid.length > 0 && !movedTo;

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
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wider text-muted">
                      <th className="pb-2 font-medium">Previous dues</th>
                      <th className="pb-2 font-medium">Left unpaid</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carried.map((c) => (
                      <tr key={c.key} className="border-b border-line/60">
                        <td className="py-2.5 text-fg">{c.label} (part paid)</td>
                        <td className="py-2.5 text-xs text-muted">
                          {c.items
                            .flatMap((d) => [d.balance > 0 && `${d.headName} ${rupees(d.balance)}`, d.lateLeft > 0 && `${d.headName} late fee ${rupees(d.lateLeft)}`])
                            .filter(Boolean)
                            .join(", ")}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-fg">{rupees(c.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Late fees: one per month a fee has stayed unpaid, each can be ticked off */}
              {lateMonths.length > 0 && (
                <fieldset className="mt-4">
                  <legend className="mb-1 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-muted">
                    <span>Late fee</span>
                    <span className="flex gap-3 normal-case tracking-normal">
                      <button type="button" onClick={() => setLateChoice(Object.fromEntries(lateMonths.map((l) => [l.key, true])))} className="font-medium text-accent-text hover:underline">
                        All
                      </button>
                      <button type="button" onClick={() => setLateChoice(Object.fromEntries(lateMonths.map((l) => [l.key, false])))} className="font-medium text-accent-text hover:underline">
                        None
                      </button>
                    </span>
                  </legend>
                  <ul className="divide-y divide-line/60 rounded-xl border border-line">
                    {lateMonths.map((l) => (
                      <li key={l.key}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition hover:bg-surface-2">
                          <input type="checkbox" checked={isOn(l)} onChange={(e) => setLateChoice((c) => ({ ...c, [l.key]: e.target.checked }))} className={checkboxClass} />
                          <span className={`min-w-0 flex-1 ${isOn(l) ? "text-fg" : "text-muted line-through"}`}>
                            {l.label} <span className="text-muted">· {l.fee}</span>
                            {l.beforeAdmission && <span className="ml-1 text-xs text-muted">(before admission)</span>}
                          </span>
                          <span className={`tabular-nums ${isOn(l) ? "text-danger" : "text-subtle line-through"}`}>{rupees(l.amount)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}

              <div className="mt-4 space-y-1.5 text-sm">
                {(discounted > 0 || discount > 0 || paidSoFar > 0 || carriedTotal > 0 || lateFixed > 0) && <Row label="Fees" value={rupees(month.charged)} />}
                {discounted > 0 && <Row label={month.items.some((d) => d.waived > 0) ? "Discount / waived" : "Discount"} value={`− ${rupees(discounted)}`} tone="text-success" />}
                {lateFixed > 0 && <Row label="Late fee" value={rupees(lateFixed)} tone="text-danger" />}
                {lateWrittenOff > 0 && <Row label="Late fee waived" value={`− ${rupees(lateWrittenOff)}`} tone="text-success" />}
                {!paid && paidSoFar > 0 && <Row label="Paid so far" value={`− ${rupees(paidSoFar)}`} tone="text-success" />}
                {movedTo && <Row label={`Moved to ${movedTo.label} bill`} value={`− ${rupees(month.balance)}`} tone="text-muted" />}
                {carriedTotal > 0 && <Row label="Previous dues" value={rupees(carriedTotal)} />}
                {!paid && !movedTo && newLate > 0 && (
                  <Row label={`Late fee (${lateMonths.filter(isOn).length} month${lateMonths.filter(isOn).length === 1 ? "" : "s"})`} value={rupees(newLate)} tone="text-danger" />
                )}
                {!paid && discount > 0 && <Row label="Discount now" value={`− ${rupees(discount - plan.unusedDiscount)}`} tone="text-success" />}
                <div className="flex items-baseline justify-between border-t-2 border-fg/80 pt-3">
                  <span className="font-semibold text-fg">{paid ? "Paid in full" : movedTo ? "Left on this bill" : "Total payable"}</span>
                  <span className={`text-2xl font-semibold tabular-nums ${paid ? "text-success" : "text-fg"}`}>
                    {rupees(paid ? month.charged - discounted + lateCollected : movedTo ? 0 : plan.full)}
                  </span>
                </div>
                {movedTo && (
                  <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                    Part paid. The {rupees(month.balance)} left is collected on the{" "}
                    <Link href={`./${movedTo.key}`} className="font-semibold underline">
                      {movedTo.label} bill
                    </Link>{" "}
                    as previous dues.
                  </p>
                )}
                {!paid && lateMonths.length === 0 && unpaid.some((d) => d.lateFeeRate > 0) && (
                  <p className="text-xs text-muted">
                    A late fee of {rupees(unpaid.reduce((n, d) => n + d.lateFeeRate, 0))} applies if paid after {day(unpaid.map((d) => d.due).sort()[0])}
                    {unpaid.some((d) => d.lateFeeMonthly) && ", and again each month it stays unpaid"}.
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
                    {r.onBill && ` · with the ${r.onBill} bill`}
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

      {waive && student.active && carriedTotal > 0 && <WaiveDues month={month.key} total={carriedTotal + carried.reduce((n, c) => n + c.items.reduce((m, d) => m + lateFeeOwed(d, today), 0), 0)} action={waive} />}

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
          {lateMonths.map((l) => (
            <input key={l.key} type="hidden" name={isOn(l) ? "lateOn" : "lateOff"} value={l.key} />
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
              {nextBill ? ` moves to the ${nextBill.label} bill as previous dues.` : " stays due on this bill."}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted">Leave it for the full {rupees(plan.full)}, or enter less for a part payment.</p>
          )}
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
              {plan.unusedDiscount > 0 && <span className="block text-danger">The discount is more than the fees.</span>}
            </p>
            <Button type="submit" size="lg" loading={pending} icon={IndianRupee} disabled={plan.unusedDiscount > 0 || plan.excess > 0 || plan.lines.length === 0}>
              {part ? `Collect ${rupees(plan.total)} (part)` : `Collect ${rupees(plan.total)}`}
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
