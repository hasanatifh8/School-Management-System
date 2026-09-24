"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PhotoInput } from "@/components/photo-input";
import { FormSection, buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import { toDateInput, type ActionState } from "@/lib/action-state";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import {
  CATEGORY_LABELS,
  DEFAULT_NATIONALITY,
  MAX_STUDENT_AGE,
  MIN_STUDENT_AGE,
  RELIGIONS,
  dateOfBirthBounds,
  normalizeIndianMobile,
} from "@/lib/student-options";

type ClassOption = { id: string; name: string; sections: { id: string; name: string }[] };

type StudentValues = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  bloodGroup: string | null;
  dateOfBirth: Date | null;
  aadhaarNumber: string | null;
  category: string | null;
  caste: string | null;
  religion: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  primaryAddress: string | null;
  correspondenceAddress: string | null;
  lastSchoolName: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  admissionDate: Date | null;
  sectionId: string | null;
  rollNumber: number | null;
  houseId: string | null;
};

type HouseOption = { id: string; name: string };

/**
 * A "Same as …" checkbox. While ticked it replaces `children` with a note, and
 * the server copies the other field. Follows the form's reset after a save.
 */
function SameAs({
  name,
  label,
  initial,
  note,
  children,
}: {
  name: string;
  label: string;
  initial: boolean;
  note: string;
  children: ReactNode;
}) {
  const [checked, setChecked] = useState(initial);
  const initialRef = useRef(initial);
  const boxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  useEffect(() => {
    const form = boxRef.current?.form;
    if (!form) return;
    const onReset = () => setChecked(initialRef.current);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <>
      {checked ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
          {note}
        </p>
      ) : (
        children
      )}
      <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input
          ref={boxRef}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className={checkboxClass}
        />
        {label}
      </label>
    </>
  );
}

export function StudentForm({
  action,
  classes,
  houses,
  student,
  submitLabel,
  cancelHref,
  photoUrl,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  classes: ClassOption[];
  houses: HouseOption[];
  student?: StudentValues;
  submitLabel: string;
  cancelHref?: string;
  /** URL of the saved photo, if any. */
  photoUrl?: string | null;
}) {
  const dob = dateOfBirthBounds();
  const whatsappSameAsPhone =
    !!student?.whatsappNumber && normalizeIndianMobile(student.phone ?? "") === student.whatsappNumber;
  // New students usually have one address; existing ones keep what was saved.
  const correspondenceSame = student
    ? !!student.primaryAddress && student.primaryAddress === student.correspondenceAddress
    : true;

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
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                <Field label="First name" name="firstName" errors={e} required>
                  <input name="firstName" required defaultValue={student?.firstName} className={inputClass} />
                </Field>
                <Field label="Middle name" name="middleName" errors={e}>
                  <input name="middleName" placeholder="Optional" defaultValue={student?.middleName ?? ""} className={inputClass} />
                </Field>
                <Field label="Last name" name="lastName" errors={e} required>
                  <input name="lastName" required defaultValue={student?.lastName} className={inputClass} />
                </Field>
              </div>
              <Field label="Gender" name="gender" errors={e}>
                <select name="gender" defaultValue={student?.gender ?? ""} className={selectClass}>
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field
                label="Date of birth"
                name="dateOfBirth"
                errors={e}
                hint={`Student must be ${MIN_STUDENT_AGE}–${MAX_STUDENT_AGE} years old.`}
              >
                <input
                  type="date"
                  name="dateOfBirth"
                  min={dob.min}
                  max={dob.max}
                  defaultValue={toDateInput(student?.dateOfBirth)}
                  className={inputClass}
                />
              </Field>
              <Field label="Blood group" name="bloodGroup" errors={e}>
                <select name="bloodGroup" defaultValue={student?.bloodGroup ?? ""} className={selectClass}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {BLOOD_GROUP_LABELS[b]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Aadhaar number" name="aadhaarNumber" errors={e} hint="12 digits.">
                <input
                  name="aadhaarNumber"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="1234 5678 9012"
                  defaultValue={student?.aadhaarNumber ?? ""}
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Nationality" name="nationality" errors={e}>
                <input
                  name="nationality"
                  defaultValue={student ? (student.nationality ?? "") : DEFAULT_NATIONALITY}
                  className={inputClass}
                />
              </Field>
            </FormSection>

            <FormSection title="Category & religion" description="As recorded on admission documents.">
              <Field label="Category" name="category" errors={e}>
                <select name="category" defaultValue={student?.category ?? ""} className={selectClass}>
                  <option value="">Select category</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Religion" name="religion" errors={e}>
                <select name="religion" defaultValue={student?.religion ?? ""} className={selectClass}>
                  <option value="">Select religion</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Caste" name="caste" errors={e}>
                <input name="caste" defaultValue={student?.caste ?? ""} className={inputClass} />
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
              <Field
                label="Roll number"
                name="rollNumber"
                errors={e}
                hint="Unique in the section. Or use “Auto-assign roll numbers” on the class page."
              >
                <input
                  type="number"
                  name="rollNumber"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="e.g. 12"
                  defaultValue={student?.rollNumber ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="House" name="houseId" errors={e}>
                <select name="houseId" defaultValue={student?.houseId ?? ""} className={selectClass}>
                  <option value="">No house</option>
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Last school name" name="lastSchoolName" errors={e}>
                <input
                  name="lastSchoolName"
                  placeholder="Previous school, if any"
                  defaultValue={student?.lastSchoolName ?? ""}
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
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">WhatsApp number</span>
                <SameAs
                  name="whatsappSameAsPhone"
                  label="Same as phone"
                  initial={whatsappSameAsPhone}
                  note="Uses the phone number above."
                >
                  <input
                    type="tel"
                    name="whatsappNumber"
                    aria-label="WhatsApp number"
                    placeholder="10-digit mobile"
                    defaultValue={student?.whatsappNumber ?? ""}
                    className={inputClass}
                  />
                </SameAs>
                {e?.whatsappNumber?.[0] && (
                  <span className="mt-1.5 block text-xs font-medium text-rose-600">{e.whatsappNumber[0]}</span>
                )}
              </div>
            </FormSection>

            <FormSection title="Address" description="Primary (permanent) and correspondence address.">
              <Field label="Primary address" name="primaryAddress" errors={e} className="sm:col-span-2">
                <textarea name="primaryAddress" rows={2} defaultValue={student?.primaryAddress ?? ""} className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Correspondence address</span>
                <SameAs
                  name="correspondenceSameAsPrimary"
                  label="Same as primary address"
                  initial={correspondenceSame}
                  note="Uses the primary address above."
                >
                  <textarea
                    name="correspondenceAddress"
                    aria-label="Correspondence address"
                    rows={2}
                    defaultValue={student?.correspondenceAddress ?? ""}
                    className={inputClass}
                  />
                </SameAs>
              </div>
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
