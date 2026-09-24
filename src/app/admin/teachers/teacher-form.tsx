"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PhotoInput } from "@/components/photo-input";
import { FormSection, buttonVariants, inputClass, selectClass } from "@/components/ui";
import { toDateInput, type ActionState } from "@/lib/action-state";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";

type TeacherValues = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  bloodGroup: string | null;
  email: string | null;
  phone: string | null;
  qualification: string | null;
  joiningDate: Date | null;
};

export function TeacherForm({
  action,
  teacher,
  submitLabel,
  cancelHref,
  photoUrl,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  teacher?: TeacherValues;
  submitLabel: string;
  cancelHref?: string;
  /** URL of the saved photo, if any. */
  photoUrl?: string | null;
}) {
  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
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
                <select name="gender" defaultValue={teacher?.gender ?? ""} className={selectClass}>
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Blood group" name="bloodGroup" errors={e}>
                <select name="bloodGroup" defaultValue={teacher?.bloodGroup ?? ""} className={selectClass}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {BLOOD_GROUP_LABELS[b]}
                    </option>
                  ))}
                </select>
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
              <Field label="Joining date" name="joiningDate" errors={e}>
                <input
                  type="date"
                  name="joiningDate"
                  defaultValue={toDateInput(teacher?.joiningDate ?? new Date())}
                  className={inputClass}
                />
              </Field>
            </FormSection>

            <FormSection title="Contact" description="Used for school communication.">
              <Field label="Email" name="email" errors={e}>
                <input type="email" name="email" placeholder="teacher@example.com" defaultValue={teacher?.email ?? ""} className={inputClass} />
              </Field>
              <Field label="Phone" name="phone" errors={e}>
                <input type="tel" name="phone" placeholder="10-digit mobile" defaultValue={teacher?.phone ?? ""} className={inputClass} />
              </Field>
            </FormSection>

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
