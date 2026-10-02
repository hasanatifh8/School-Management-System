"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Building2, CalendarClock, ChevronDown, CreditCard, FileCheck2, IndianRupee, Percent, QrCode, Wallet } from "lucide-react";
import { Field, FormMessage } from "@/components/forms";
import { Badge, Button, SegmentedControl, SuccessState, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, dueKey, rupees, type DueItem } from "@/lib/fees-shared";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));
const monthOf = (iso: string) => new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);

const MODE_ICONS = { CASH: Banknote, UPI: QrCode, CARD: CreditCard, CHEQUE: FileCheck2, BANK_TRANSFER: Building2, OTHER: Wallet };

const STATUS = {
  PAID: { tone: "green", label: "Paid" },
  PARTIAL: { tone: "amber", label: "Part paid" },
  OVERDUE: { tone: "red", label: "Due" },
  UPCOMING: { tone: "slate", label: "Upcoming" },
} as const;

type Group = { month: string; items: DueItem[]; balance: number; due: string };

/** Instalments grouped by the month they fall due, in date order. */
function byMonth(items: DueItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const d of [...items].sort((a, b) => a.due.localeCompare(b.due) || a.headName.localeCompare(b.headName))) {
    const month = d.due.slice(0, 7);
    const g = groups.get(month) ?? { month, items: [], balance: 0, due: d.due };
    g.items.push(d);
    g.balance += d.balance;
    groups.set(month, g);
  }
  return [...groups.values()];
}

/**
 * Collect a payment. What's due up to today is listed month by month and ticked
 * to start with; later months stay folded under "Pay in advance" so the page
 * stays short. Amounts can be lowered for part payments; admins can give a
 * discount (with a reason).
 */
export function CollectForm({
  dues,
  today,
  minDate,
  action,
  canDiscount = false,
}: {
  dues: DueItem[];
  today: string;
  minDate: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Admins may waive part of an instalment (needs a reason). */
  canDiscount?: boolean;
}) {
  const open = useMemo(() => dues.filter((d) => d.balance > 0), [dues]);
  const dueNow = useMemo(() => byMonth(open.filter((d) => d.due <= today)), [open, today]);
  const advance = useMemo(() => byMonth(open.filter((d) => d.due > today)), [open, today]);
  const paid = useMemo(() => byMonth(dues.filter((d) => d.balance <= 0)), [dues]);

  const allDueKeys = () => new Set(open.filter((d) => d.due <= today).map((d) => dueKey(d.headId, d.period)));
  const [selected, setSelected] = useState(allDueKeys);
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(open.map((d) => [dueKey(d.headId, d.period), String(d.balance)])));
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [discountOn, setDiscountOn] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  // Months whose fees are listed one by one: those due now, to start with.
  const [expanded, setExpanded] = useState(() => new Set(dueNow.length <= 3 ? dueNow.map((g) => g.month) : dueNow.slice(-2).map((g) => g.month)));
  const [mode, setMode] = useState("CASH");
  const [state, formAction, pending] = useActionState(action, {});

  const k = (d: DueItem) => dueKey(d.headId, d.period);
  const chosen = open.filter((d) => selected.has(k(d)));
  const total = chosen.reduce((n, d) => n + (Number(amounts[k(d)]) || 0), 0);
  const discountTotal = discountOn ? chosen.reduce((n, d) => n + (Number(discounts[k(d)]) || 0), 0) : 0;
  const advanceChosen = chosen.filter((d) => d.due > today).length;

  const setMany = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  const toggleMonth = (month: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  /** A discount lowers what's left to pay on that instalment. */
  const setDiscount = (d: DueItem, value: string) => {
    const disc = Math.min(Number(value) || 0, d.balance);
    setDiscounts((x) => ({ ...x, [k(d)]: value ? String(disc) : "" }));
    setAmounts((a) => ({ ...a, [k(d)]: String(d.balance - disc) }));
  };
  const turnOffDiscount = () => {
    setDiscountOn(false);
    setDiscounts({});
    setAmounts(Object.fromEntries(open.map((d) => [k(d), String(d.balance)])));
  };

  const dueNowTotal = dueNow.reduce((n, g) => n + g.balance, 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="overflow-clip rounded-2xl border border-line bg-surface shadow-card"
    >
      {/* What is sent: the ticked instalments only, wherever they are on screen. */}
      {chosen.map((d) => (
        <span key={k(d)} hidden>
          <input type="hidden" name={`pay:${k(d)}`} value={amounts[k(d)] ?? ""} />
          {discountOn && discounts[k(d)] && <input type="hidden" name={`disc:${k(d)}`} value={discounts[k(d)]} />}
        </span>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-fg">Collect payment</h2>
          <p className="text-xs text-muted">{dueNowTotal ? `${rupees(dueNowTotal)} due up to today` : "Nothing due right now"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {dueNow.length > 0 && (
            <button type="button" onClick={() => setSelected(allDueKeys())} className="font-medium text-accent-text underline-offset-4 hover:underline">
              Tick all due
            </button>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="font-medium text-muted hover:text-fg">
            Clear
          </button>
          {canDiscount && open.length > 0 && (
            <button
              type="button"
              onClick={() => (discountOn ? turnOffDiscount() : setDiscountOn(true))}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset transition ${discountOn ? "bg-success-soft text-success ring-success-line" : "text-muted ring-line hover:text-fg"}`}
            >
              <Percent className="h-3 w-3" />
              {discountOn ? "Discount on" : "Give discount"}
            </button>
          )}
        </div>
      </div>

      {open.length === 0 ? (
        <SuccessState title="All paid up" description="Every fee for this session is paid." />
      ) : (
        <div className="divide-y divide-line">
          {/* Due up to today */}
          {dueNow.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted sm:px-6">Nothing is due yet. Fees for coming months are under “Pay in advance” below.</p>
          ) : (
            dueNow.map((g) => (
              <MonthGroup
                key={g.month}
                group={g}
                open={expanded.has(g.month)}
                onToggle={() => toggleMonth(g.month)}
                selected={selected}
                setMany={setMany}
                amounts={amounts}
                setAmount={(d, v) => setAmounts((a) => ({ ...a, [k(d)]: v }))}
                discountOn={discountOn}
                discounts={discounts}
                setDiscount={setDiscount}
              />
            ))
          )}

          {/* Months ahead, folded away until asked for */}
          {advance.length > 0 && (
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
                    {shortMonth.format(monthOf(advance[0].due))}
                    {advance.length > 1 && ` – ${shortMonth.format(monthOf(advance.at(-1)!.due))}`} · {advance.length} month{advance.length === 1 ? "" : "s"} ·{" "}
                    {rupees(advance.reduce((n, g) => n + g.balance, 0))}
                  </span>
                </span>
                {advanceChosen > 0 && <Badge tone="indigo">{advanceChosen} ticked</Badge>}
                <ChevronDown className={`h-4 w-4 shrink-0 text-subtle transition ${showAdvance ? "rotate-180" : ""}`} />
              </button>
              {showAdvance && (
                <div className="divide-y divide-line border-t border-line">
                  {advance.map((g) => (
                    <MonthGroup
                      key={g.month}
                      group={g}
                      open={expanded.has(g.month)}
                      onToggle={() => toggleMonth(g.month)}
                      selected={selected}
                      setMany={setMany}
                      amounts={amounts}
                      setAmount={(d, v) => setAmounts((a) => ({ ...a, [k(d)]: v }))}
                      discountOn={discountOn}
                      discounts={discounts}
                      setDiscount={setDiscount}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {paid.length > 0 && (
        <div className="border-t border-line">
          <button type="button" onClick={() => setShowPaid((v) => !v)} className="w-full px-4 py-2.5 text-left text-xs font-medium text-muted hover:text-fg sm:px-6">
            {showPaid ? "Hide paid fees" : `Show paid fees (${paid.reduce((n, g) => n + g.items.length, 0)})`}
          </button>
          {showPaid && (
            <ul className="divide-y divide-line border-t border-line text-sm">
              {paid.flatMap((g) =>
                g.items.map((d) => (
                  <li key={k(d)} className="flex items-center gap-3 px-4 py-2 text-subtle sm:px-6">
                    <span className="min-w-0 flex-1 truncate">
                      {d.headName} <span className="text-xs">· {d.label}</span>
                    </span>
                    <span className="tabular-nums">{rupees(d.amount)}</span>
                    <Badge tone="green">Paid</Badge>
                  </li>
                )),
              )}
            </ul>
          )}
        </div>
      )}

      {open.length > 0 && (
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
              <input type="date" name="date" defaultValue={today} min={minDate} max={today} required className={inputClass} />
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
            {discountTotal > 0 && (
              <Field label="Reason for discount" name="discountNote" errors={state.fieldErrors} required className="sm:col-span-3">
                <input name="discountNote" required maxLength={200} placeholder="e.g. Sibling discount, staff ward, scholarship" className={inputClass} />
              </Field>
            )}
          </div>
          <FormMessage state={state} />
        </div>
      )}

      {open.length > 0 && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-4 rounded-b-2xl border-t border-line bg-glass px-4 py-4 backdrop-blur-xl sm:px-6 md:bottom-0">
          <div>
            <p className="text-eyebrow uppercase text-muted">
              Total · {chosen.length} fee{chosen.length === 1 ? "" : "s"}
            </p>
            <p className="text-display-sm font-semibold tabular-nums text-fg">{rupees(total)}</p>
            {discountTotal > 0 && <p className="text-xs font-medium text-success">+ {rupees(discountTotal)} discount</p>}
          </div>
          <Button type="submit" size="lg" loading={pending} icon={IndianRupee} disabled={total + discountTotal <= 0}>
            Collect & make receipt
          </Button>
        </div>
      )}
    </form>
  );
}

/** One month: a tickable summary line, and (when opened) its fees with amounts to pay. */
function MonthGroup({
  group,
  open,
  onToggle,
  selected,
  setMany,
  amounts,
  setAmount,
  discountOn,
  discounts,
  setDiscount,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  selected: Set<string>;
  setMany: (keys: string[], on: boolean) => void;
  amounts: Record<string, string>;
  setAmount: (d: DueItem, value: string) => void;
  discountOn: boolean;
  discounts: Record<string, string>;
  setDiscount: (d: DueItem, value: string) => void;
}) {
  const keys = group.items.map((d) => dueKey(d.headId, d.period));
  const count = keys.filter((key) => selected.has(key)).length;
  const all = count === keys.length;
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = count > 0 && !all;
  }, [count, all]);
  const status = group.items.some((d) => d.status === "OVERDUE") ? "OVERDUE" : group.items.some((d) => d.status === "PARTIAL") ? "PARTIAL" : "UPCOMING";
  const paying = group.items.reduce((n, d) => (selected.has(dueKey(d.headId, d.period)) ? n + (Number(amounts[dueKey(d.headId, d.period)]) || 0) : n), 0);

  return (
    <div className={count ? "bg-accent-soft/40" : ""}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <input
          ref={box}
          type="checkbox"
          checked={all}
          onChange={() => setMany(keys, !all)}
          className={checkboxClass}
          aria-label={`Pay all of ${monthName.format(monthOf(group.due))}`}
        />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">{monthName.format(monthOf(group.due))}</span>
              <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
            </span>
            <span className="block truncate text-xs text-muted">
              {group.items.length === 1 ? group.items[0].headName : `${group.items.length} fees: ${group.items.map((d) => d.headName).join(", ")}`} · due {fmt(group.due)}
            </span>
          </span>
          <span className="text-right tabular-nums">
            <span className="block font-semibold text-fg">{rupees(count ? paying : group.balance)}</span>
            {count > 0 && count < keys.length && <span className="block text-[11px] text-muted">{count} of {keys.length} ticked</span>}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <ul className="pb-2">
          {group.items.map((d) => {
            const key = dueKey(d.headId, d.period);
            const on = selected.has(key);
            return (
              <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5 pl-11 pr-4 text-sm sm:pl-14 sm:pr-6">
                <input type="checkbox" checked={on} onChange={() => setMany([key], !on)} className={checkboxClass} aria-label={`Pay ${d.headName} ${d.label}`} />
                <span className="min-w-0 flex-1">
                  <span className="text-fg-2">{d.headName}</span>
                  <span className="text-xs text-muted">
                    {" "}
                    · {d.label}
                    {d.paid > 0 && ` · ${rupees(d.paid)} paid`}
                    {d.discount > 0 && ` · ${rupees(d.discount)} waived`}
                  </span>
                </span>
                {discountOn && (
                  <label className="flex items-center gap-1 text-xs text-success">
                    −
                    <input
                      disabled={!on}
                      inputMode="numeric"
                      placeholder="0"
                      value={discounts[key] ?? ""}
                      onChange={(e) => setDiscount(d, e.target.value.replace(/[^\d]/g, ""))}
                      aria-label={`Discount for ${d.headName} ${d.label}`}
                      className="h-8 w-20 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm tabular-nums text-success focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:bg-surface-2 disabled:text-subtle"
                    />
                  </label>
                )}
                <input
                  disabled={!on}
                  inputMode="numeric"
                  value={on ? (amounts[key] ?? "") : String(d.balance)}
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
