"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { LogoInput } from "@/components/logo-input";
import { PasswordField } from "@/components/password-field";
import { Select } from "@/components/select";
import { buttonVariants, checkboxClass, FormActions, FormSection, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export const BOARDS = ["CBSE", "ICSE / ISC", "State Board", "IB", "Cambridge (IGCSE)", "NIOS", "Other"];

export const SCHOOL_TYPES = [
  { value: "PRIVATE", label: "Private" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "SEMI_GOVERNMENT", label: "Semi-government" },
  { value: "OTHER", label: "Other" },
] as const;

type SchoolValues = {
  name: string;
  code: string;
  board: string | null;
  schoolType: string | null;
  udiseCode: string | null;
  affiliationNo: string | null;
  affiliationYear: number | null;
  principalName: string | null;
  establishedYear: number | null;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export function SchoolForm({
  action,
  school,
  logoUrl,
  submitLabel,
  cancelHref,
  offerDemo = false,
  lockCode = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  school?: SchoolValues;
  logoUrl?: string | null;
  submitLabel: string;
  cancelHref?: string;
  offerDemo?: boolean;
  /** Show the code read-only: only Power Admin changes it. */
  lockCode?: boolean;
}) {
  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <FormSection title="Identity" description="Name and code identify the school everywhere.">
              <LogoInput currentUrl={logoUrl} error={e?.logo?.[0]} />
              <Field label="School name" name="name" errors={e} required>
                <input name="name" required defaultValue={school?.name} placeholder="e.g. Delhi Public School" className={inputClass} />
              </Field>
              <Field
                label="School code"
                name="code"
                errors={e}
                required={!lockCode}
                hint={lockCode ? "Set by Power Admin" : "Short and unique, e.g. DPS or SVM01"}
              >
                <input
                  name="code"
                  required
                  disabled={lockCode}
                  maxLength={12}
                  defaultValue={school?.code}
                  placeholder="DPS"
                  className={`${inputClass} font-mono uppercase placeholder:normal-case`}
                />
              </Field>
              <Field label="Board" name="board" errors={e}>
                <Select name="board" defaultValue={school?.board ?? ""} className={selectClass}>
                  <option value="">Select board</option>
                  {BOARDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="School type" name="schoolType" errors={e}>
                <Select name="schoolType" defaultValue={school?.schoolType ?? ""} className={selectClass}>
                  <option value="">Select type</option>
                  {SCHOOL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="UDISE code" name="udiseCode" errors={e} hint="11 digits, from UDISE+">
                <input
                  name="udiseCode"
                  inputMode="numeric"
                  maxLength={11}
                  defaultValue={school?.udiseCode ?? ""}
                  placeholder="07050100101"
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Affiliation / registration number" name="affiliationNo" errors={e}>
                <input name="affiliationNo" maxLength={40} defaultValue={school?.affiliationNo ?? ""} placeholder="e.g. 2730123" className={inputClass} />
              </Field>
              <Field label="Affiliation / registration year" name="affiliationYear" errors={e}>
                <input
                  name="affiliationYear"
                  type="number"
                  min={1800}
                  max={new Date().getFullYear()}
                  defaultValue={school?.affiliationYear ?? ""}
                  placeholder="2005"
                  className={inputClass}
                />
              </Field>
              <Field label="Established (year)" name="establishedYear" errors={e}>
                <input
                  name="establishedYear"
                  type="number"
                  min={1800}
                  max={new Date().getFullYear()}
                  defaultValue={school?.establishedYear ?? ""}
                  placeholder="1995"
                  className={inputClass}
                />
              </Field>
              <Field label="Principal" name="principalName" errors={e}>
                <input name="principalName" defaultValue={school?.principalName ?? ""} className={inputClass} />
              </Field>
              <Field label="Motto" name="motto" errors={e}>
                <input name="motto" defaultValue={school?.motto ?? ""} placeholder="e.g. Service before self" className={inputClass} />
              </Field>
            </FormSection>

            <FormSection title="Contact" description="Shown to parents and on printed documents later.">
              <Field label="Phone" name="phone" errors={e}>
                <input type="tel" name="phone" defaultValue={school?.phone ?? ""} className={inputClass} />
              </Field>
              <Field label="Email" name="email" errors={e}>
                <input type="email" name="email" defaultValue={school?.email ?? ""} placeholder="office@school.edu.in" className={inputClass} />
              </Field>
              <Field label="Website" name="website" errors={e}>
                <input name="website" defaultValue={school?.website ?? ""} placeholder="https://school.edu.in" className={inputClass} />
              </Field>
              <Field label="Address" name="address" errors={e} className="sm:col-span-2">
                <textarea name="address" rows={2} defaultValue={school?.address ?? ""} className={inputClass} />
              </Field>
            </FormSection>

            {offerDemo && (
              <FormSection
                title="School admin"
                description="Optional. This person signs in at /login and manages only this school. You can add more admins later."
              >
                <Field label="Admin name" name="adminName" errors={e}>
                  <input name="adminName" placeholder="e.g. Priya Sharma" className={inputClass} />
                </Field>
                <Field label="Admin email (used to sign in)" name="adminEmail" errors={e}>
                  <input type="email" name="adminEmail" autoComplete="off" placeholder="admin@school.edu.in" className={inputClass} />
                </Field>
                <Field label="Password" name="adminPassword" errors={e} className="sm:col-span-2" hint="At least 8 characters with a letter and a number.">
                  <PasswordField name="adminPassword" generate required={false} />
                </Field>
              </FormSection>
            )}

            {offerDemo && (
              <label className="flex items-start gap-3 rounded-xl border border-accent-line bg-accent-soft/60 p-4 text-sm text-accent-text">
                <input type="checkbox" name="loadDemo" className={`${checkboxClass} mt-0.5`} />
                <span>
                  <span className="font-medium">Load demo data</span>
                  <span className="block text-accent-text/80">
                    Classes 1–5, subjects, houses, 4 teachers and 20 students — handy for trying things out. You can reset it later.
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
