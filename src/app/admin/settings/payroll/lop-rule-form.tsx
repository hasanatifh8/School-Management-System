"use client";

import { useState } from "react";
import { Calculator, CalendarX2, CircleHelp, Coins, Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { SegmentedControl, cx, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { rupees } from "@/lib/fees-shared";
import { lopAmount, lopDayRate, lopRuleText, type LopRule } from "@/lib/payroll-shared";

// The worked example under the form: a sample salary in a 31-day month.
const SAMPLE = { gross: 30_000, basic: 18_000, days: 31, absent: 2, halfDays: 1, unmarked: 1 };

/**
 * How absent days come off salaries: a share of a day's pay (gross or basic ÷ a
 * number of days) or a fixed amount a day, with a worked example as you type.
 */
export function LopRuleForm({ action, initial }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; initial: LopRule }) {
  const dayPay = initial.method === "DAY_PAY" ? initial : null;
  const [method, setMethod] = useState<LopRule["method"]>(initial.method);
  const [base, setBase] = useState<"GROSS" | "BASIC">(dayPay?.base ?? "GROSS");
  const presetOf = (d: number | null) => (d == null ? "MONTH" : d === 30 || d === 26 ? String(d) : "CUSTOM");
  const [divisor, setDivisor] = useState(presetOf(dayPay ? dayPay.divisor : null));
  const [customDivisor, setCustomDivisor] = useState(dayPay?.divisor && presetOf(dayPay.divisor) === "CUSTOM" ? String(dayPay.divisor) : "");
  const [percent, setPercent] = useState(String(dayPay?.percent ?? 100));
  const [amount, setAmount] = useState(initial.method === "FIXED" ? String(initial.amount) : "");
  const [countUnmarked, setCountUnmarked] = useState(initial.countUnmarked);

  // The rule as typed so far, for the example (invalid numbers fall back to safe values).
  const draft: LopRule =
    method === "FIXED"
      ? { method: "FIXED", amount: Number(amount) || 0, countUnmarked }
      : {
          method: "DAY_PAY",
          base,
          divisor: divisor === "MONTH" ? null : divisor === "CUSTOM" ? Math.min(31, Math.max(1, Number(customDivisor) || 30)) : Number(divisor),
          percent: percent === "" ? 100 : Number(percent),
          countUnmarked,
        };
  const unpaid = SAMPLE.absent + SAMPLE.halfDays / 2 + (countUnmarked ? SAMPLE.unmarked : 0);
  const rate = lopDayRate(draft, SAMPLE, SAMPLE.days);
  const cut = lopAmount(draft, SAMPLE, unpaid, SAMPLE.days);

  const choice = (on: boolean) =>
    cx("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition", on ? "border-accent bg-accent-soft ring-2 ring-accent/20" : "border-line hover:border-line-strong");

  return (
    <ActionForm action={action} keepValues className="space-y-5">
      {(state) => (
        <>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium text-fg-2">For each absent day, take off</legend>
            <label className={choice(method === "DAY_PAY")}>
              <input type="radio" name="method" value="DAY_PAY" checked={method === "DAY_PAY"} onChange={() => setMethod("DAY_PAY")} className="sr-only" />
              <CalendarX2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
              <span>
                <span className="block font-medium text-fg">A day&apos;s pay</span>
                <span className="block text-xs text-muted">Salary ÷ days, e.g. ₹30,000 ÷ 30 = ₹1,000 a day. Optionally only a share of it.</span>
              </span>
            </label>
            <label className={choice(method === "FIXED")}>
              <input type="radio" name="method" value="FIXED" checked={method === "FIXED"} onChange={() => setMethod("FIXED")} className="sr-only" />
              <Coins className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
              <span>
                <span className="block font-medium text-fg">A fixed amount</span>
                <span className="block text-xs text-muted">The same rupees for everyone, e.g. ₹500 for each absent day.</span>
              </span>
            </label>
          </fieldset>

          {method === "DAY_PAY" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-fg-2">Based on</span>
                <input type="hidden" name="base" value={base} />
                <SegmentedControl
                  label="Based on"
                  value={base}
                  onChange={setBase}
                  options={[
                    { value: "GROSS", label: "Gross pay" },
                    { value: "BASIC", label: "Basic pay" },
                  ]}
                />
              </div>
              <Field label="Divided by" name="divisor" errors={state.fieldErrors}>
                <select name="divisor" value={divisor} onChange={(e) => setDivisor(e.target.value)} className={selectClass}>
                  <option value="30">30 days, every month</option>
                  <option value="26">26 days (working days)</option>
                  <option value="MONTH">Days in that month (28–31)</option>
                  <option value="CUSTOM">Another number…</option>
                </select>
              </Field>
              {divisor === "CUSTOM" ? (
                <Field label="Number of days" name="customDivisor" errors={state.fieldErrors} required>
                  <input
                    name="customDivisor"
                    inputMode="numeric"
                    value={customDivisor}
                    onChange={(e) => setCustomDivisor(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="e.g. 25"
                    className={`${inputClass} tabular-nums`}
                  />
                </Field>
              ) : (
                <span className="hidden sm:block" />
              )}
              <Field label="Share of a day's pay" name="percent" errors={state.fieldErrors} hint="100% takes off a full day's pay; 50% half of it.">
                <div className="relative max-w-40">
                  <input
                    name="percent"
                    inputMode="decimal"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))}
                    className={`${inputClass} pr-8 tabular-nums`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">%</span>
                </div>
              </Field>
            </div>
          ) : (
            <Field label="Amount for each absent day" name="amount" errors={state.fieldErrors} required>
              <div className="relative max-w-48">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">₹</span>
                <input
                  name="amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 500"
                  className={`${inputClass} pl-7 tabular-nums`}
                />
              </div>
            </Field>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-2">
              Working days with no attendance mark
              <span title="A day when staff attendance was taken but this person has no mark and no approved leave. Days before their joining date, and before the month's first day of staff attendance, never count.">
                <CircleHelp className="h-4 w-4 text-subtle" aria-hidden />
              </span>
            </legend>
            <input type="hidden" name="unmarked" value={countUnmarked ? "ABSENT" : "IGNORE"} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={choice(countUnmarked)}>
                <input type="radio" name="unmarkedChoice" checked={countUnmarked} onChange={() => setCountUnmarked(true)} className="sr-only" />
                <span>
                  <span className="block font-medium text-fg">Count as absent (recommended)</span>
                  <span className="block text-xs text-muted">No mark means not present: the day is unpaid. Keeps salaries honest when the register is missed.</span>
                </span>
              </label>
              <label className={choice(!countUnmarked)}>
                <input type="radio" name="unmarkedChoice" checked={!countUnmarked} onChange={() => setCountUnmarked(false)} className="sr-only" />
                <span>
                  <span className="block font-medium text-fg">Don&apos;t deduct</span>
                  <span className="block text-xs text-muted">Only days marked Absent (or Half day) are unpaid. Unmarked days are paid.</span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="rounded-xl bg-surface-2 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-fg">
              <Calculator className="h-4 w-4 text-accent-text" /> {lopRuleText(draft).replace(/^./, (c) => c.toUpperCase())}
            </p>
            <p className="mt-1.5 text-muted">
              Example: gross {rupees(SAMPLE.gross)} (basic {rupees(SAMPLE.basic)}) in a {SAMPLE.days}-day month, {SAMPLE.absent} absent days, {SAMPLE.halfDays} half day and{" "}
              {SAMPLE.unmarked} day not marked{countUnmarked ? "" : " (not deducted)"} ={" "}
              {unpaid} unpaid days × {rupees(Math.round(rate))} a day ={" "}
              <span className="font-semibold tabular-nums text-danger">−{rupees(cut)}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">A half day counts as half an absent day. Days on approved leave are never deducted.</p>
            <SubmitButton icon={<Save className="h-4 w-4" />}>Save deduction</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
