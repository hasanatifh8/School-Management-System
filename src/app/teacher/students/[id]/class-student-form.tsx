"use client";

import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PhotoInput } from "@/components/photo-input";
import { SameAs } from "@/components/same-as";
import { FormSection, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Values = {
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  primaryAddress: string | null;
  correspondenceAddress: string | null;
  rollNumber: number | null;
};

/** The parts of a student's record a class teacher may update. */
export function ClassStudentForm({
  action,
  student,
  photoUrl,
  whatsappSameAsPhone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  student: Values;
  photoUrl: string | null;
  whatsappSameAsPhone: boolean;
}) {
  const correspondenceSame = !!student.primaryAddress && student.primaryAddress === student.correspondenceAddress;
  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <FormSection title="Photo">
              <PhotoInput currentUrl={photoUrl} error={e?.photo?.[0]} />
            </FormSection>
            <FormSection title="Class" description="Unique within your class.">
              <Field label="Roll number" name="rollNumber" errors={e}>
                <input type="number" name="rollNumber" min={1} step={1} defaultValue={student.rollNumber ?? ""} className={inputClass} />
              </Field>
            </FormSection>
            <FormSection title="Contact">
              <Field label="Phone" name="phone" errors={e}>
                <input type="tel" name="phone" defaultValue={student.phone ?? ""} className={inputClass} />
              </Field>
              <Field label="Email" name="email" errors={e}>
                <input type="email" name="email" defaultValue={student.email ?? ""} className={inputClass} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">WhatsApp number</span>
                <SameAs name="whatsappSameAsPhone" label="Same as phone" initial={whatsappSameAsPhone} note="Uses the phone number above.">
                  <input type="tel" name="whatsappNumber" aria-label="WhatsApp number" defaultValue={student.whatsappNumber ?? ""} className={inputClass} />
                </SameAs>
                {e?.whatsappNumber?.[0] && <span className="mt-1.5 block text-xs font-medium text-rose-600">{e.whatsappNumber[0]}</span>}
              </div>
            </FormSection>
            <FormSection title="Address">
              <Field label="Primary address" name="primaryAddress" errors={e} className="sm:col-span-2">
                <textarea name="primaryAddress" rows={2} defaultValue={student.primaryAddress ?? ""} className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Correspondence address</span>
                <SameAs name="correspondenceSameAsPrimary" label="Same as primary address" initial={correspondenceSame} note="Uses the primary address above.">
                  <textarea name="correspondenceAddress" aria-label="Correspondence address" rows={2} defaultValue={student.correspondenceAddress ?? ""} className={inputClass} />
                </SameAs>
              </div>
            </FormSection>
            <div className="flex justify-end border-t border-slate-100 pt-6">
              <SubmitButton icon={<Save className="h-4 w-4" />}>Save changes</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
