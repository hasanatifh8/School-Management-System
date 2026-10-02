"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Banknote, Building2, CalendarClock, ChevronDown, CreditCard, FileCheck2, IndianRupee, QrCode, Wallet } from "lucide-react";
import { Field, FormMessage } from "@/components/forms";
import { Badge, Button, SegmentedControl, SuccessState, checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, allocateDiscount, dueKey, feeSummary, monthLabel, rupees, type DueItem, type MonthDues } from "@/lib/fees-shared";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));
const shortMonth = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const monthShort = (m: string) => shortMonth.format(new Date(`${m}-01T00:00:00Z`));

const MODE_ICONS = { CASH: Banknote, UPI: QrCode, CARD: CreditCard, CHEQUE: FileCheck2, BANK_TRANSFER: Building2, OTHER: Wallet };

const key = (d: DueItem) => dueKey(d.headId, d.period);

/**
 * Collect a payment for a billing month: that month's fees as one total,
 * earlier unpaid months (with any late fee) as one line each, later months
 * folded under "Pay in advance". A late fee can be waived and a discount
 * given for the whole payment; it is spread over the fees being paid.
 */
export function CollectForm({
  dues,
  today,
  minDate,
  targetMonth,
  months,
  action,
}: {
  dues: DueItem[];
  today: string;
  minDate: string;
  /** "2026-10": the billing month. */
  targetMonth: string;
  /** The session's months, for the month picker. */
  months: string[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const summary = useMemo(() => feeSummary(dues, targetMonth), [dues, targetMonth]);
  const open = useMemo(() => dues.filter((d) => d.balance > 0), [dues]);

  // To start with: this month and every earlier unpaid month.
  const [selected, setSelected] = useState(() => new Set([...summary.current, ...summary.previous.flatMap((g) => g.items)].map(key)));
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(open.map((d) => [key(d), String(d.balance)])));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAdvance, setShowAdvance] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const paidItems = useMemo(() => dues.filter((d) => d.balance <= 0), [dues]);
  const [waiveLate, setWaiveLate] = useState(false);
  const [discountText, setDiscountText] = useState("");
  const [mode, setMode] = useState("CASH");
  const [payDate, setPayDate] = useState(today);
  const [state, formAction, pending] = useActionState(action, {});
  /** Late fee for an instalment if paid on the payment date entered (as the server works it out). */
  const lateOf = (d: DueItem) => (payDate > d.lateAfter ? d.lateFeeRate : 0);
  const lateIn = (items: DueItem[]) => items.reduce((n, d) => n + lateOf(d), 0);

  const chosen = open.filter((d) => selected.has(key(d)));
  const paying = (d: DueItem) => Math.min(d.balance, Number(amounts[key(d)]) || 0);
  const sumOf = (items: DueItem[]) => items.filter((d) => selected.has(key(d))).reduce((n, d) => n + paying(d), 0);
  const gross = chosen.reduce((n, d) => n + paying(d), 0);
  const lateOwed = lateIn(chosen.filter((d) => paying(d) > 0));
  const lateFee = waiveLate ? 0 : lateOwed;
  const discount = Math.min(Number(discountText) || 0, gross);
  const shares = useMemo(
    () => allocateDiscount(chosen.map((d) => ({ key: key(d), balance: paying(d), month: d.due.slice(0, 7) })), discount, targetMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed from the values it reads
    [discount, targetMonth, selected, amounts],
  );
  const net = gross - discount + lateFee;
  const currentTotal = sumOf(summary.current);
  const previousTotal = summary.previous.reduce((n, g) => n + sumOf(g.items), 0);
  const advanceTotal = summary.advance.reduce((n, g) => n + sumOf(g.items), 0);

  const setMany = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  const toggleOpen = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const groupProps = { selected, setMany, amounts, setAmount: (d: DueItem, v: string) => setAmounts((a) => ({ ...a, [key(d)]: v })), waiveLate, lateOf };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
      className="overflow-clip rounded-2xl border border-line bg-surface shadow-card"
    >
      {/* What is sent: each ticked fee's payment and its share of the discount. */}
      {chosen.map((d) => {
        const share = shares.get(key(d)) ?? 0;
        return (
          <span key={key(d)} hidden>
            <input type="hidden" name={`pay:${key(d)}`} value={paying(d) - share} />
            {share > 0 && <input type="hidden" name={`disc:${key(d)}`} value={share} />}
          </span>
        );
      })}
      {waiveLate && <input type="hidden" name="waiveLateFee" value="on" />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-fg">Collect payment</h2>
          <p className="text-xs text-muted">Outstanding up to {summary.label}: {rupees(summary.totalOutstanding)}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Billing month
          <select
            value={targetMonth}
            onChange={(e) => router.replace(`${pathname}?month=${e.target.value}`, { scroll: false })}
            className={`${selectClass} !w-44 !py-1.5`}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {open.length === 0 ? (
        <SuccessState title="All paid up" description="Every fee for this session is paid." />
      ) : (
        <div className="divide-y divide-line">
          {/* This month, as one total */}
          <Section title={`${summary.label} fees`} total={summary.currentTotal} late={lateIn(summary.current)} waiveLate={waiveLate}>
            {summary.current.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted sm:px-6">No fee falls due in {summary.label}.</p>
            ) : (
              <MonthRow
                group={{ month: targetMonth, label: "This month", items: summary.current, amount: summary.currentTotal, lateFee: summary.currentLate, subtotal: summary.currentTotal + summary.currentLate }}
                title={summary.current.length === 1 ? summary.current[0].headName : `${summary.current.length} fees`}
                open={expanded.has("current")}
                onToggle={() => toggleOpen("current")}
                {...groupProps}
              />
            )}
          </Section>

          {/* Earlier months still unpaid */}
          {summary.previous.length > 0 && (
            <Section title="Previous dues" total={summary.previousTotal} late={lateIn(summary.previous.flatMap((g) => g.items))} waiveLate={waiveLate}>
              <div className="divide-y divide-line">
                {summary.previous.map((g) => (
                  <MonthRow key={g.month} group={g} title={g.label} open={expanded.has(g.month)} onToggle={() => toggleOpen(g.month)} {...groupProps} />
                ))}
              </div>
            </Section>
          )}

          {/* Later months, folded away */}
          {summary.advance.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvance((v) => !v)}
                aria-expanded={showAdvance}
                className="flex w-full items-center gap-3 bg-surface-2/60 px-4 py-3 text-left text-sm transition hover:bg-surface-2 sm:px-6"
              >
                <CalendarClock className="h-4 w-4 shrink-0 text-subtle" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-fg">Pay in advance</span>
                  <span className="block text-xs text-muted">
                    {monthShort(summary.advance[0].month)}
                    {summary.advance.length > 1 && ` – ${monthShort(summary.advance.at(-1)!.month)}`} · {rupees(summary.advance.reduce((n, g) => n + g.amount, 0))}
                  </span>
                </span>
                {advanceTotal > 0 && <Badge tone="indigo">{rupees(advanceTotal)} ticked</Badge>}
                <ChevronDown className={`h-4 w-4 shrink-0 text-subtle transition ${showAdvance ? "rotate-180" : ""}`} />
              </button>
              {showAdvance && (
                <div className="divide-y divide-line border-t border-line">
                  {summary.advance.map((g) => (
                    <MonthRow key={g.month} group={g} title={g.label} open={expanded.has(g.month)} onToggle={() => toggleOpen(g.month)} {...groupProps} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {paidItems.length > 0 && (
        <div className="border-t border-line">
          <button type="button" onClick={() => setShowPaid((v) => !v)} className="w-full px-4 py-2.5 text-left text-xs font-medium text-muted hover:text-fg sm:px-6">
            {showPaid ? "Hide paid fees" : `Show paid fees (${paidItems.length})`}
          </button>
          {showPaid && (
            <ul className="divide-y divide-line border-t border-line text-sm">
              {paidItems.map((d) => (
                <li key={key(d)} className="flex items-center gap-3 px-4 py-2 text-subtle sm:px-6">
                  <span className="min-w-0 flex-1 truncate">
                    {d.headName} <span className="text-xs">· {d.label}</span>
                  </span>
                  <span className="tabular-nums">{rupees(d.paid)}</span>
                  {d.discount > 0 && <span className="text-xs text-success">−{rupees(d.discount)}</span>}
                  <Badge tone="green">Paid</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open.length > 0 && (
        <>
          {/* Late fee and discount */}
          <div className="grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-2 sm:px-6">
            <div className="rounded-xl border border-line p-3">
              <p className="flex items-center justify-between text-sm">
                <span className="font-medium text-fg">Late fee</span>
                <span className={`tabular-nums ${waiveLate ? "text-subtle line-through" : "font-semibold text-fg"}`}>{rupees(lateOwed)}</span>
              </p>
              <label className={`mt-2 flex items-center gap-2 text-sm ${lateOwed ? "text-fg-2" : "text-subtle"}`}>
                <input type="checkbox" checked={waiveLate} disabled={!lateOwed} onChange={(e) => setWaiveLate(e.target.checked)} className={checkboxClass} />
                Waive late fee
              </label>
            </div>
            <div className="rounded-xl border border-line p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-fg">Discount (₹)</span>
                <input
                  inputMode="numeric"
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                  placeholder="0"
                  aria-label="Discount in rupees"
                  className="h-9 w-28 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm tabular-nums text-success focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
                />
              </label>
              <p className="mt-1 text-xs text-muted">
                {Number(discountText) > gross ? `Capped at ${rupees(gross)}, the fees being paid.` : "Recorded on this receipt only; the fee structure is unchanged."}
              </p>
            </div>
          </div>

          {/* Payment details */}
          <div className="space-y-4 border-t border-line px-4 py-5 sm:px-6">
            <fieldset>
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
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Payment date" name="date" errors={state.fieldErrors} required>
                <input
                  type="date"
                  name="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value || today)}
                  min={minDate}
                  max={today}
                  required
                  className={inputClass}
                />
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
              {discount > 0 && (
                <Field label="Reason for discount" name="discountNote" errors={state.fieldErrors} required className="sm:col-span-3">
                  <input name="discountNote" required maxLength={200} placeholder="e.g. Sibling discount, staff ward, scholarship" className={inputClass} />
                </Field>
              )}
            </div>
            <FormMessage state={state} />
          </div>

          {/* Net payable */}
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-4 rounded-b-2xl border-t border-line bg-glass px-4 py-4 backdrop-blur-xl sm:px-6 md:bottom-0">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-0.5 text-xs text-muted sm:flex sm:flex-wrap sm:items-baseline">
              {previousTotal > 0 && <Part label="Previous dues" value={previousTotal} />}
              <Part label={summary.label} value={currentTotal} />
              {advanceTotal > 0 && <Part label="Advance" value={advanceTotal} />}
              {lateFee > 0 && <Part label="Late fee" value={lateFee} sign="+" />}
              {discount > 0 && <Part label="Discount" value={discount} sign="−" tone="text-success" />}
              <div className="col-span-2 sm:ml-2">
                <dt className="text-eyebrow uppercase text-muted">Net payable</dt>
                <dd className="text-display-sm font-semibold tabular-nums text-fg">{rupees(net)}</dd>
              </div>
            </dl>
            <Button type="submit" size="lg" loading={pending} icon={IndianRupee} disabled={gross <= 0}>
              Collect & make receipt
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

function Part({ label, value, sign, tone = "text-fg" }: { label: string; value: number; sign?: string; tone?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`text-sm font-semibold tabular-nums ${tone}`}>
        {sign && `${sign} `}
        {rupees(value)}
      </dd>
    </div>
  );
}

/** A heading with its total (and late fee), over its rows. */
function Section({ title, total, late, waiveLate, children }: { title: string; total: number; late: number; waiveLate: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-4 sm:px-6">
        <h3 className="text-eyebrow uppercase text-muted">{title}</h3>
        <span className="text-xs text-muted">
          <span className="font-semibold tabular-nums text-fg">{rupees(total)}</span>
          {late > 0 && <span className={waiveLate ? "line-through" : ""}> + {rupees(late)} late fee</span>}
        </span>
      </div>
      {children}
    </section>
  );
}

/** One month (or this month's demand): a tickable total line, and its fees when opened. */
function MonthRow({
  group,
  title,
  open,
  onToggle,
  selected,
  setMany,
  amounts,
  setAmount,
  waiveLate,
  lateOf,
}: {
  group: MonthDues;
  title: string;
  open: boolean;
  onToggle: () => void;
  selected: Set<string>;
  setMany: (keys: string[], on: boolean) => void;
  amounts: Record<string, string>;
  setAmount: (d: DueItem, value: string) => void;
  waiveLate: boolean;
  lateOf: (d: DueItem) => number;
}) {
  const keys = group.items.map(key);
  const late = group.items.reduce((n, d) => n + lateOf(d), 0);
  const count = keys.filter((k) => selected.has(k)).length;
  const all = count === keys.length;
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = count > 0 && !all;
  }, [count, all]);
  const status = group.items.some((d) => d.status === "OVERDUE") ? "Due" : group.items.some((d) => d.status === "PARTIAL") ? "Part paid" : "Upcoming";

  return (
    <div className={count ? "bg-accent-soft/40" : ""}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <input ref={box} type="checkbox" checked={all} onChange={() => setMany(keys, !all)} className={checkboxClass} aria-label={`Pay ${title}`} />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">{title}</span>
              <Badge tone={status === "Due" ? "red" : status === "Part paid" ? "amber" : "slate"}>{status}</Badge>
              {group.items[0].arrears && <Badge tone="red">Arrears {group.items[0].arrears}</Badge>}
              {group.items.some((d) => d.beforeAdmission) && <Badge>Before admission</Badge>}
            </span>
            <span className="block truncate text-xs text-muted">
              {group.items.map((d) => d.headName).join(", ")} · due {fmt(group.items[0].due)}
            </span>
          </span>
          <span className="text-right tabular-nums">
            <span className="block font-semibold text-fg">{rupees(group.amount)}</span>
            {late > 0 && <span className={`block text-[11px] text-danger ${waiveLate ? "line-through opacity-60" : ""}`}>+ {rupees(late)} late</span>}
            {count > 0 && !all && (
              <span className="block text-[11px] text-muted">
                {count} of {keys.length} ticked
              </span>
            )}
          </span>
          <span className="text-xs font-medium text-accent-text">{open ? "Hide" : "Breakdown"}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <ul className="pb-2">
          {group.items.map((d) => {
            const k = key(d);
            const on = selected.has(k);
            return (
              <li key={k} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pl-11 pr-4 text-sm sm:pl-14 sm:pr-6">
                <input type="checkbox" checked={on} onChange={() => setMany([k], !on)} className={checkboxClass} aria-label={`Pay ${d.headName} ${d.label}`} />
                <span className="min-w-0 flex-1">
                  <span className="text-fg-2">{d.headName}</span>
                  <span className="text-xs text-muted">
                    {" "}
                    · {d.label}
                    {d.paid > 0 && ` · ${rupees(d.paid)} paid`}
                    {lateOf(d) > 0 && ` · late fee ${rupees(lateOf(d))}`}
                  </span>
                </span>
                <input
                  disabled={!on}
                  inputMode="numeric"
                  value={on ? (amounts[k] ?? "") : String(d.balance)}
                  onChange={(e) => setAmount(d, e.target.value.replace(/[^\d]/g, ""))}
                  aria-label={`Amount for ${d.headName} ${d.label}`}
                  className="h-8 w-24 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:border-transparent disabled:bg-transparent disabled:text-muted"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
