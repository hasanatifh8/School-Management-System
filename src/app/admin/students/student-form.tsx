"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PhotoInput } from "@/components/photo-input";
import { FormSection, buttonVariants, inputClass, selectClass } from "@/components/ui";
import { toDateInput, type ActionState } from "@/lib/action-state";

type ClassOption = { id: string; name: string; sections: { id: string; name: string }[] };

type StudentValues = {
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: Date | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  admissionDate: Date | null;
  sectionId: string | null;
};

export function StudentForm({
  action,
  classes,
  student,
  submitLabel,
  cancelHref,
  photoUrl,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  classes: ClassOption[];
  student?: StudentValues;
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

            <FormSection title="Personal information" description="Basic details as per school records.">
              <Field label="First name" name="firstName" errors={e} required>
                <input name="firstName" required defaultValue={student?.firstName} className={inputClass} />
              </Field>
              <Field label="Last name" name="lastName" errors={e} required>
                <input name="lastName" required defaultValue={student?.lastName} className={inputClass} />
              </Field>
              <Field label="Gender" name="gender" errors={e}>
                <select name="gender" defaultValue={student?.gender ?? ""} className={selectClass}>
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Date of birth" name="dateOfBirth" errors={e}>
                <input type="date" name="dateOfBirth" defaultValue={toDateInput(student?.dateOfBirth)} className={inputClass} />
              </Field>
            </FormSection>

            <FormSection
              title="Academic"
              description="The class's subjects are allotted automatically when a class is chosen."
            >
              <Field label="Class & section" name="sectionId" errors={e}>
                <select name="sectionId" defaultValue={student?.sectionId ?? ""} className={selectClass}>
                  <option value="">Not assigned</option>
                  {classes.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      {c.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {c.name} – {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Admission date" name="admissionDate" errors={e}>
                <input
                  type="date"
                  name="admissionDate"
                  defaultValue={toDateInput(student?.admissionDate ?? new Date())}
                  className={inputClass}
                />
              </Field>
            </FormSection>

            <FormSection title="Contact" description="How to reach the student directly.">
              <Field label="Email" name="email" errors={e}>
                <input type="email" name="email" placeholder="student@example.com" defaultValue={student?.email ?? ""} className={inputClass} />
              </Field>
              <Field label="Phone" name="phone" errors={e}>
                <input type="tel" name="phone" placeholder="10-digit mobile" defaultValue={student?.phone ?? ""} className={inputClass} />
              </Field>
              <Field label="Address" name="address" errors={e} className="sm:col-span-2">
                <textarea name="address" rows={2} defaultValue={student?.address ?? ""} className={inputClass} />
              </Field>
            </FormSection>

            <FormSection title="Parents" description="Father's and mother's details for school communication.">
              <Field label="Father's name" name="fatherName" errors={e}>
                <input name="fatherName" defaultValue={student?.fatherName ?? ""} className={inputClass} />
              </Field>
              <Field label="Father's phone" name="fatherPhone" errors={e}>
                <input type="tel" name="fatherPhone" defaultValue={student?.fatherPhone ?? ""} className={inputClass} />
              </Field>
              <Field label="Mother's name" name="motherName" errors={e}>
                <input name="motherName" defaultValue={student?.motherName ?? ""} className={inputClass} />
              </Field>
              <Field label="Mother's phone" name="motherPhone" errors={e}>
                <input type="tel" name="motherPhone" defaultValue={student?.motherPhone ?? ""} className={inputClass} />
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
