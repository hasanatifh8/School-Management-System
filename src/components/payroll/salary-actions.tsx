"use client";

import { useState } from "react";
import { Banknote, Plus, Sparkles, TriangleAlert } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PaySalaryForm } from "@/components/expenses/pay-salary-form";
import { OneTimeItemForm } from "@/components/payroll/one-time-item-form";
import { Button, Modal, inputClass, selectClass, type ButtonVariant } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { CALC_LABELS, looksLikeAbsence, type SalaryCalcKey, type SalaryKind } from "@/lib/payroll-shared";
import { paySalary } from "@/app/admin/expenses/actions";
import { addOneTimeItem, addPersonalComponent } from "@/app/admin/payroll/actions";

type Person = { teacherId: string } | { staffId: string };

/** "Pay" for one person's month, in a dialog that closes once paid. */
export function PayPersonButton({
  personKey,
  name,
  month,
  monthName,
  net,
  lopDays,
  lopAmount,
  today,
}: {
  personKey: string;
  name: string;
  month: string;
  monthName: string;
  net: number;
  lopDays: number;
  lopAmount: number;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={Banknote} onClick={() => setOpen(true)}>
        Pay {monthName}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Pay ${name}`} description={`${monthName} · paying makes a draft slip to check and publish`}>
        {open && (
          <div className="p-6">
            <PaySalaryForm action={paySalary.bind(null, personKey, month)} net={net} lopDays={lopDays} lopAmount={lopAmount} today={today} onSuccess={() => setOpen(false)} />
          </div>
        )}
      </Modal>
    </>
  );
}

/** Adds a one-time earning or deduction for this person, for a month they're not yet paid for. */
export function AddOneTimeItemButton({
  personKey,
  name,
  months,
  variant = "secondary",
}: {
  personKey: string;
  name: string;
  months: { value: string; label: string; disabled?: boolean; selected?: boolean }[];
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} icon={Plus} onClick={() => setOpen(true)}>
        Add one-time item
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`One-time item for ${name}`} description="A bonus, arrears or an advance recovered: for one month only.">
        {open && (
          <div className="p-6">
            <OneTimeItemForm action={addOneTimeItem.bind(null, null)} person={personKey} months={months} monthName="" onSuccess={() => setOpen(false)} />
          </div>
        )}
      </Modal>
    </>
  );
}

/** Adds a regular earning or deduction just for this person (every month), e.g. a special allowance. */
export function PersonalComponentButton({ person, name }: { person: Person; name: string }) {
  const [open, setOpen] = useState(false);
  const [calc, setCalc] = useState<SalaryCalcKey>("FIXED");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<SalaryKind>("EARNING");
  const percent = calc === "PERCENT_OF_BASIC";
  return (
    <>
      <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => setOpen(true)}>
        Add component for {name.split(" ")[0]}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={`New component for ${name}`}
        description="Paid every month from now on, only to them. For one month only, add a one-time item instead."
      >
        {open && (
          <ActionForm action={addPersonalComponent.bind(null, person)} onSuccess={() => setOpen(false)} className="space-y-4 p-6">
            {(state: ActionState) => (
              <>
                <Field label="Name" name="name" errors={state.fieldErrors} required hint="Printed on the slip. Using an existing component's name gives them that one.">
                  <input
                    name="name"
                    required
                    maxLength={40}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Special allowance, Hostel warden pay"
                    className={inputClass}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type" name="kind" errors={state.fieldErrors}>
                    <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as SalaryKind)} className={selectClass}>
                      <option value="EARNING">Earning (adds to pay)</option>
                      <option value="DEDUCTION">Deduction (taken off)</option>
                    </select>
                  </Field>
                  <Field label="Worked out as" name="calc" errors={state.fieldErrors}>
                    <select name="calc" value={calc} onChange={(e) => setCalc(e.target.value as SalaryCalcKey)} className={selectClass}>
                      {(Object.keys(CALC_LABELS) as SalaryCalcKey[]).map((k) => (
                        <option key={k} value={k}>
                          {CALC_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {kind === "DEDUCTION" && looksLikeAbsence(title) && (
                  <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning ring-1 ring-inset ring-warning-line">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      This is taken off <strong>every month</strong>, whatever the attendance. To deduct for absences or extra leave, don&apos;t add a component: use
                      Settings → Payroll → <strong>Deduction for absent days</strong>.
                    </span>
                  </p>
                )}
                <Field label={percent ? "Percent of basic" : "Amount (₹ a month)"} name="value" errors={state.fieldErrors} required>
                  <div className="relative max-w-48">
                    <input name="value" required inputMode="decimal" placeholder={percent ? "e.g. 10" : "e.g. 2000"} className={`${inputClass} tabular-nums ${percent ? "pr-8" : "pl-7"}`} />
                    <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-subtle ${percent ? "right-3" : "left-3"}`}>{percent ? "%" : "₹"}</span>
                  </div>
                </Field>
                <SubmitButton icon={<Plus className="h-4 w-4" />}>Add to salary</SubmitButton>
              </>
            )}
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
