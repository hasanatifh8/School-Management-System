"use client";

import Link from "next/link";
import { Save, Wallet } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Select } from "@/components/select";
import { PhotoInput } from "@/components/photo-input";
import { SameAs } from "@/components/same-as";
import { CredentialsNotice } from "@/components/credentials-notice";
import { buttonVariants, checkboxClass, FormActions, FormSection, inputClass, selectClass } from "@/components/ui";
import { toDateInput, type ActionState } from "@/lib/action-state";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { ageBounds, normalizeIndianMobile, shiftYears } from "@/lib/student-options";
import { todayISO } from "@/lib/attendance-shared";
import { MAX_STAFF_AGE, MIN_STAFF_AGE, STAFF_JOBS } from "./schema";

type StaffValues = {
  name: string;
  designation: string;
  gender: string | null;
  bloodGroup: string | null;
  dateOfBirth: Date | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  qualification: string | null;
  experienceYears: number | null;
  monthlySalary: number | null;
  joiningDate: Date | null;
};

export function StaffForm({
  action,
  staff,
  submitLabel,
  cancelHref,
  photoUrl,
  offerCashier = false,
  isCashier = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  staff?: StaffValues;
  submitLabel: string;
  cancelHref?: string;
  /** URL of the saved photo, if any. */
  photoUrl?: string | null;
  /** Show "Make this person a cashier" (new staff). */
  offerCashier?: boolean;
  /** Already a cashier: the email is their sign-in. */
  isCashier?: boolean;
}) {
  const dob = ageBounds(MIN_STAFF_AGE, MAX_STAFF_AGE);
  const today = todayISO();
  const whatsappSameAsPhone = !!staff?.whatsappNumber && normalizeIndianMobile(staff.phone ?? "") === staff.whatsappNumber;

  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
        if (state.credentials) {
          // Added as a cashier: show the sign-in once, then continue to the profile.
          return (
            <div className="space-y-4">
              <CredentialsNotice {...state.credentials} message={state.message} />
              <p className="text-sm text-muted">They sign in at /login with this email and see only Fees.</p>
              {state.next && (
                <Link href={state.next} className={buttonVariants.primary}>
                  Continue to profile
                </Link>
              )}
            </div>
          );
        }
        return (
          <>
            <FormSection title="Photo" description="Shown on the profile and in lists.">
              <PhotoInput currentUrl={photoUrl} error={e?.photo?.[0]} />
            </FormSection>

            <FormSection title="Personal information" description="Name and basic details.">
              <Field label="Full name" name="name" errors={e} required className="sm:col-span-2">
                <input name="name" maxLength={100} required defaultValue={staff?.name} placeholder="e.g. Ramesh Kumar" className={inputClass} />
              </Field>
              <Field label="Gender" name="gender" errors={e}>
                <Select name="gender" defaultValue={staff?.gender ?? ""} className={selectClass}>
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Blood group" name="bloodGroup" errors={e}>
                <Select name="bloodGroup" defaultValue={staff?.bloodGroup ?? ""} className={selectClass}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {BLOOD_GROUP_LABELS[b]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date of birth" name="dateOfBirth" errors={e} hint={`Must be ${MIN_STAFF_AGE}–${MAX_STAFF_AGE} years old.`}>
                <input type="date" name="dateOfBirth" min={dob.min} max={dob.max} defaultValue={toDateInput(staff?.dateOfBirth)} className={inputClass} />
              </Field>
            </FormSection>

            <FormSection title="Job & qualification" description="Role, education and employment details.">
              <Field label="Job" name="designation" errors={e} required>
                <input name="designation" list="staff-jobs" maxLength={60} required defaultValue={staff?.designation} placeholder="e.g. Accountant" className={inputClass} />
              </Field>
              <datalist id="staff-jobs">
                {STAFF_JOBS.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
              <Field label="Qualification / degree" name="qualification" errors={e}>
                <input name="qualification" maxLength={100} placeholder="e.g. B.Com, 12th pass, ITI" defaultValue={staff?.qualification ?? ""} className={inputClass} />
              </Field>
              <Field label="Experience (years)" name="experienceYears" errors={e} hint="Total work experience.">
                <input type="number" name="experienceYears" min={0} max={60} step={1} inputMode="numeric" placeholder="e.g. 5" defaultValue={staff?.experienceYears ?? ""} className={inputClass} />
              </Field>
              <Field label="Joining date" name="joiningDate" errors={e} hint="Not in the future.">
                <input
                  type="date"
                  name="joiningDate"
                  min={shiftYears(today, MIN_STAFF_AGE - MAX_STAFF_AGE)}
                  max={today}
                  defaultValue={toDateInput(staff ? staff.joiningDate : new Date())}
                  className={inputClass}
                />
              </Field>
              <Field label="Monthly salary (₹)" name="monthlySalary" errors={e} hint="Whole rupees, e.g. 12000. Used for payroll in Expenses.">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-subtle">₹</span>
                  <input name="monthlySalary" inputMode="numeric" placeholder="12,000" defaultValue={staff?.monthlySalary ?? ""} className={`${inputClass} pl-8 tabular-nums`} />
                </div>
              </Field>
            </FormSection>

            <FormSection title="Contact" description="Used for school communication.">
              <Field label="Email" name="email" errors={e} hint={isCashier ? "Used to sign in as cashier." : offerCashier ? "Needed if this person will be a cashier." : undefined}>
                <input type="email" name="email" placeholder="name@example.com" required={isCashier} defaultValue={staff?.email ?? ""} className={inputClass} />
              </Field>
              <Field label="Phone" name="phone" errors={e}>
                <input type="tel" name="phone" inputMode="tel" maxLength={16} placeholder="10-digit mobile" defaultValue={staff?.phone ?? ""} className={inputClass} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-fg-2">WhatsApp number</span>
                <SameAs name="whatsappSameAsPhone" label="Same as phone" initial={whatsappSameAsPhone} note="Uses the phone number above.">
                  <input type="tel" name="whatsappNumber" aria-label="WhatsApp number" placeholder="10-digit mobile" defaultValue={staff?.whatsappNumber ?? ""} className={inputClass} />
                </SameAs>
                {e?.whatsappNumber?.[0] && <span className="mt-1.5 block text-xs font-medium text-danger">{e.whatsappNumber[0]}</span>}
              </div>
              <Field label="Address" name="address" errors={e} className="sm:col-span-2">
                <textarea name="address" rows={2} defaultValue={staff?.address ?? ""} className={inputClass} />
              </Field>
            </FormSection>

            {offerCashier && (
              <label className="flex items-start gap-3 rounded-xl border border-accent-line bg-accent-soft/60 p-4 text-sm text-accent-text">
                <input type="checkbox" name="makeCashier" className={`${checkboxClass} mt-0.5`} />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Wallet className="h-4 w-4" aria-hidden /> Make this person a cashier
                  </span>
                  <span className="block text-accent-text/80">
                    They can sign in with their email and collect fees, nothing else. A password is generated for them. Other staff don&apos;t get a login.
                  </span>
                </span>
              </label>
            )}

            <FormActions>
              {cancelHref && (
                <Link href={cancelHref} className={buttonVariants.secondary}>
                  Cancel
                </Link>
              )}
              <SubmitButton icon={<Save className="h-4 w-4" />}>{submitLabel}</SubmitButton>
            </FormActions>
          </>
        );
      }}
    </ActionForm>
  );
}
