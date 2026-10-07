"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Select } from "@/components/select";
import { AadhaarInput } from "@/components/aadhaar-input";
import { PhotoInput } from "@/components/photo-input";
import { SameAs } from "@/components/same-as";
import { buttonVariants, FormActions, inputClass, selectClass } from "@/components/ui";
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
  shiftYears,
} from "@/lib/student-options";
import { todayISO } from "@/lib/attendance-shared";
import { GuardianFields } from "./guardian-fields";

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
  fatherOccupation: string | null;
  guardianName: string | null;
  guardianRelation: string | null;
  motherName: string | null;
  admissionDate: Date | null;
  sectionId: string | null;
  rollNumber: number | null;
  houseId: string | null;
};

type HouseOption = { id: string; name: string };

export function StudentForm({
  action,
  classes,
  houses,
  student,
  submitLabel,
  submitIcon = <Save className="h-4 w-4" />,
  cancelHref,
  photoUrl,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  classes: ClassOption[];
  houses: HouseOption[];
  student?: StudentValues;
  submitLabel: string;
  /** Defaults to a save icon. */
  submitIcon?: ReactNode;
  cancelHref?: string;
  /** URL of the saved photo, if any. */
  photoUrl?: string | null;
}) {
  const dob = dateOfBirthBounds();
  const today = todayISO();
  const whatsappSameAsPhone =
    !!student?.whatsappNumber && normalizeIndianMobile(student.phone ?? "") === student.whatsappNumber;
  // New students usually have one address; existing ones keep what was saved.
  // The father is the usual guardian: ticked for new students, and for existing
  // ones with no guardian recorded yet (only if a father's name exists, so saving
  // other changes never trips the "enter the father's name" check).
  const guardianIsFather = student
    ? student.guardianName
      ? student.guardianName === student.fatherName
      : !!student.fatherName
    : true;
  const correspondenceSame = student
    ? !!student.primaryAddress && student.primaryAddress === student.correspondenceAddress
    : true;

  return (
    <ActionForm action={action} className="space-y-6">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <AdmissionSection step={1} title="Student details" description="As per the birth certificate and Aadhaar card.">
              <div className="sm:col-span-2 lg:col-span-3">
                <PhotoInput currentUrl={photoUrl} error={e?.photo?.[0]} />
              </div>
              <Field label="First name" name="firstName" errors={e} required>
                <input name="firstName" maxLength={100} required defaultValue={student?.firstName} className={inputClass} />
              </Field>
              <Field label="Middle name" name="middleName" errors={e}>
                <input name="middleName" maxLength={100} placeholder="Optional" defaultValue={student?.middleName ?? ""} className={inputClass} />
              </Field>
              <Field label="Last name" name="lastName" errors={e} required>
                <input name="lastName" maxLength={100} required defaultValue={student?.lastName} className={inputClass} />
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
              <Field label="Gender" name="gender" errors={e}>
                <Select name="gender" defaultValue={student?.gender ?? ""} className={selectClass}>
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Blood group" name="bloodGroup" errors={e}>
                <Select name="bloodGroup" defaultValue={student?.bloodGroup ?? ""} className={selectClass}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {BLOOD_GROUP_LABELS[b]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Aadhaar number" name="aadhaarNumber" errors={e} hint="12 digits, e.g. 1234-5678-9012.">
                <AadhaarInput name="aadhaarNumber" defaultValue={student?.aadhaarNumber} />
              </Field>
              <Field label="Nationality" name="nationality" errors={e}>
                <input
                  name="nationality"
                  defaultValue={student ? (student.nationality ?? "") : DEFAULT_NATIONALITY}
                  className={inputClass}
                />
              </Field>
            </AdmissionSection>

            <AdmissionSection step={2} title="Parent & guardian details" description="Parents' names and the family's mobile numbers, used for notices and messages.">
              <Field label="Father's name" name="fatherName" errors={e}>
                <input name="fatherName" maxLength={100} defaultValue={student?.fatherName ?? ""} className={inputClass} />
              </Field>
              <Field label="Mother's name" name="motherName" errors={e}>
                <input name="motherName" maxLength={100} defaultValue={student?.motherName ?? ""} className={inputClass} />
              </Field>
              <Field label="Father's occupation" name="fatherOccupation" errors={e}>
                <input
                  name="fatherOccupation"
                  maxLength={100}
                  placeholder="e.g. Engineer, Business, Farmer"
                  defaultValue={student?.fatherOccupation ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Mobile number" name="phone" errors={e}>
                <input type="tel" name="phone" inputMode="tel" maxLength={16} placeholder="10-digit mobile" defaultValue={student?.phone ?? ""} className={inputClass} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-fg-2">WhatsApp number</span>
                <SameAs name="whatsappSameAsPhone" label="Same as mobile" initial={whatsappSameAsPhone} note="Uses the mobile number.">
                  <input
                    type="tel"
                    name="whatsappNumber"
                    inputMode="tel"
                    maxLength={16}
                    aria-label="WhatsApp number"
                    placeholder="10-digit mobile"
                    defaultValue={student?.whatsappNumber ?? ""}
                    className={inputClass}
                  />
                </SameAs>
                {e?.whatsappNumber?.[0] && (
                  <span className="mt-1.5 block text-xs font-medium text-danger">{e.whatsappNumber[0]}</span>
                )}
              </div>
              <Field label="Email" name="email" errors={e}>
                <input type="email" name="email" placeholder="name@example.com" defaultValue={student?.email ?? ""} className={inputClass} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-sm font-medium text-fg-2">Guardian</span>
                <SameAs name="guardianIsFather" label="Father is the guardian" initial={guardianIsFather} note="The father's name above is used as the guardian.">
                  <GuardianFields
                    name={student && !guardianIsFather ? (student.guardianName ?? "") : ""}
                    relation={student?.guardianRelation ?? ""}
                    errors={e}
                  />
                </SameAs>
              </div>
            </AdmissionSection>

            <AdmissionSection step={3} title="Address" description="Permanent address and where letters should be sent." wide>
              <Field label="Permanent address" name="primaryAddress" errors={e}>
                <textarea name="primaryAddress" rows={3} placeholder="House no., street, city, state, PIN" defaultValue={student?.primaryAddress ?? ""} className={inputClass} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-fg-2">Correspondence address</span>
                <SameAs
                  name="correspondenceSameAsPrimary"
                  label="Same as permanent address"
                  initial={correspondenceSame}
                  note="Uses the permanent address."
                >
                  <textarea
                    name="correspondenceAddress"
                    aria-label="Correspondence address"
                    rows={3}
                    defaultValue={student?.correspondenceAddress ?? ""}
                    className={inputClass}
                  />
                </SameAs>
              </div>
            </AdmissionSection>

            <AdmissionSection step={4} title="Admission details" description="Class, roll number and house for this session. The class's subjects are allotted automatically.">
              <Field label="Class & section" name="sectionId" errors={e}>
                <Select name="sectionId" defaultValue={student?.sectionId ?? ""} className={selectClass}>
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
                </Select>
              </Field>
              <Field
                label="Date of admission"
                name="admissionDate"
                errors={e}
                hint={`Not in the future; the student must be at least ${MIN_STUDENT_AGE} on this date.`}
              >
                <input
                  type="date"
                  name="admissionDate"
                  min={shiftYears(today, -MAX_STUDENT_AGE)}
                  max={today}
                  defaultValue={toDateInput(student?.admissionDate ?? new Date())}
                  className={inputClass}
                />
              </Field>
              <Field label="Roll number" name="rollNumber" errors={e} hint="Unique in the section, or auto-assign from the class page.">
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
                <Select name="houseId" defaultValue={student?.houseId ?? ""} className={selectClass}>
                  <option value="">No house</option>
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Previous school" name="lastSchoolName" errors={e} className="sm:col-span-2">
                <input
                  name="lastSchoolName"
                  placeholder="Name of the last school attended, if any"
                  defaultValue={student?.lastSchoolName ?? ""}
                  className={inputClass}
                />
              </Field>
            </AdmissionSection>

            <AdmissionSection step={5} title="Category & religion" description="As recorded on admission documents.">
              <Field label="Category" name="category" errors={e}>
                <Select name="category" defaultValue={student?.category ?? ""} className={selectClass}>
                  <option value="">Select category</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Religion" name="religion" errors={e}>
                <Select name="religion" defaultValue={student?.religion ?? ""} className={selectClass}>
                  <option value="">Select religion</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Caste" name="caste" errors={e}>
                <input name="caste" defaultValue={student?.caste ?? ""} className={inputClass} />
              </Field>
            </AdmissionSection>

            <FormActions
              note={
                <>
                  Fields marked <span className="text-danger">*</span> are required.
                </>
              }
            >
              {cancelHref && (
                <Link href={cancelHref} className={buttonVariants.secondary}>
                  Cancel
                </Link>
              )}
              <SubmitButton icon={submitIcon}>{submitLabel}</SubmitButton>
            </FormActions>
          </>
        );
      }}
    </ActionForm>
  );
}

/** A numbered part of the admission form, like the sections of a printed form. */
function AdmissionSection({
  step,
  title,
  description,
  wide,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  /** Two columns instead of three, for long fields like addresses. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <header className="flex items-start gap-3 border-b border-line bg-surface-2 px-4 py-3 sm:px-5">
        <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg tabular-nums">
          {step}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>}
        </div>
      </header>
      <div className={`grid gap-x-5 gap-y-4 p-4 sm:grid-cols-2 sm:p-5 ${wide ? "" : "lg:grid-cols-3"}`}>{children}</div>
    </section>
  );
}
