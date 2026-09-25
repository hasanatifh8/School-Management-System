"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Select } from "@/components/select";
import { PhotoInput } from "@/components/photo-input";
import { SameAs } from "@/components/same-as";
import { CredentialsNotice } from "@/components/credentials-notice";
import { FormSection, buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import { toDateInput, type ActionState } from "@/lib/action-state";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { MAX_TEACHER_AGE, MIN_TEACHER_AGE, ageBounds, normalizeIndianMobile } from "@/lib/student-options";

type TeacherValues = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  bloodGroup: string | null;
  dateOfBirth: Date | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  qualification: string | null;
  specialization: string | null;
  experienceYears: number | null;
  monthlySalary: number | null;
  joiningDate: Date | null;
};

export function TeacherForm({
  action,
  teacher,
  submitLabel,
  cancelHref,
  photoUrl,
  offerLogin = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  teacher?: TeacherValues;
  submitLabel: string;
  cancelHref?: string;
  /** URL of the saved photo, if any. */
  photoUrl?: string | null;
  /** Show "Create a login for this teacher" (new teachers). */
  offerLogin?: boolean;
}) {
  const dob = ageBounds(MIN_TEACHER_AGE, MAX_TEACHER_AGE);
  const whatsappSameAsPhone =
    !!teacher?.whatsappNumber && normalizeIndianMobile(teacher.phone ?? "") === teacher.whatsappNumber;

  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
        if (state.credentials) {
          // Teacher created with a login: show it once, then continue to the profile.
          return (
            <div className="space-y-4">
              <CredentialsNotice {...state.credentials} message={state.message} />
              {state.next && (
                <Link href={state.next} className={buttonVariants.primary}>
                  Continue to teacher profile
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
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                <Field label="First name" name="firstName" errors={e} required>
                  <input name="firstName" required defaultValue={teacher?.firstName} className={inputClass} />
                </Field>
                <Field label="Middle name" name="middleName" errors={e}>
                  <input name="middleName" placeholder="Optional" defaultValue={teacher?.middleName ?? ""} className={inputClass} />
                </Field>
                <Field label="Last name" name="lastName" errors={e} required>
                  <input name="lastName" required defaultValue={teacher?.lastName} className={inputClass} />
                </Field>
              </div>
              <Field label="Gender" name="gender" errors={e}>
                <Select name="gender" defaultValue={teacher?.gender ?? ""} className={selectClass}>
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Blood group" name="bloodGroup" errors={e}>
                <Select name="bloodGroup" defaultValue={teacher?.bloodGroup ?? ""} className={selectClass}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {BLOOD_GROUP_LABELS[b]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Date of birth"
                name="dateOfBirth"
                errors={e}
                hint={`Teacher must be ${MIN_TEACHER_AGE}–${MAX_TEACHER_AGE} years old.`}
              >
                <input
                  type="date"
                  name="dateOfBirth"
                  min={dob.min}
                  max={dob.max}
                  defaultValue={toDateInput(teacher?.dateOfBirth)}
                  className={inputClass}
                />
              </Field>
            </FormSection>

            <FormSection title="Professional" description="Qualification and employment details.">
              <Field label="Qualification" name="qualification" errors={e}>
                <input
                  name="qualification"
                  placeholder="e.g. M.Sc, B.Ed"
                  defaultValue={teacher?.qualification ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Specialization" name="specialization" errors={e}>
                <input
                  name="specialization"
                  maxLength={100}
                  placeholder="e.g. Mathematics, Primary English"
                  defaultValue={teacher?.specialization ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Experience (years)" name="experienceYears" errors={e} hint="Total teaching experience.">
                <input
                  type="number"
                  name="experienceYears"
                  min={0}
                  max={60}
                  step={1}
                  inputMode="numeric"
                  placeholder="e.g. 8"
                  defaultValue={teacher?.experienceYears ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Joining date" name="joiningDate" errors={e}>
                <input
                  type="date"
                  name="joiningDate"
                  defaultValue={toDateInput(teacher?.joiningDate ?? new Date())}
                  className={inputClass}
                />
              </Field>
              <Field label="Monthly salary (₹)" name="monthlySalary" errors={e} hint="Whole rupees, e.g. 45000.">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                  <input
                    name="monthlySalary"
                    inputMode="numeric"
                    placeholder="45,000"
                    defaultValue={teacher?.monthlySalary ?? ""}
                    className={`${inputClass} pl-8 tabular-nums`}
                  />
                </div>
              </Field>
            </FormSection>

            <FormSection title="Contact" description="Used for school communication.">
              <Field label="Email" name="email" errors={e}>
                <input type="email" name="email" placeholder="teacher@example.com" defaultValue={teacher?.email ?? ""} className={inputClass} />
              </Field>
              <Field label="Phone" name="phone" errors={e}>
                <input type="tel" name="phone" placeholder="10-digit mobile" defaultValue={teacher?.phone ?? ""} className={inputClass} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">WhatsApp number</span>
                <SameAs name="whatsappSameAsPhone" label="Same as phone" initial={whatsappSameAsPhone} note="Uses the phone number above.">
                  <input
                    type="tel"
                    name="whatsappNumber"
                    aria-label="WhatsApp number"
                    placeholder="10-digit mobile"
                    defaultValue={teacher?.whatsappNumber ?? ""}
                    className={inputClass}
                  />
                </SameAs>
                {e?.whatsappNumber?.[0] && (
                  <span className="mt-1.5 block text-xs font-medium text-rose-600">{e.whatsappNumber[0]}</span>
                )}
              </div>
              <Field label="Address" name="address" errors={e} className="sm:col-span-2">
                <textarea name="address" rows={2} defaultValue={teacher?.address ?? ""} className={inputClass} />
              </Field>
            </FormSection>

            {offerLogin && (
              <label className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm text-indigo-900">
                <input type="checkbox" name="createLogin" defaultChecked className={`${checkboxClass} mt-0.5`} />
                <span>
                  <span className="font-medium">Create a login for this teacher</span>
                  <span className="block text-indigo-800/80">
                    A username and password are generated so they can sign in to the teacher portal and see their class.
                  </span>
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              {cancelHref && (
                <Link href={cancelHref} className={buttonVariants.secondary}>
                  Cancel
                </Link>
              )}
              <SubmitButton icon={<Save className="h-4 w-4" />}>{submitLabel}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
