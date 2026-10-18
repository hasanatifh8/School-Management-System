"use client";

import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { MobileInput } from "@/components/mobile-input";
import { PhotoInput } from "@/components/photo-input";
import { SameAs } from "@/components/same-as";
import { FormSection, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";

type Values = {
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  bloodGroup: string | null;
  qualification: string | null;
};

/** The parts of their own profile a teacher may change. */
export function MyProfileForm({
  action,
  values,
  photoUrl,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: Values;
  photoUrl: string | null;
}) {
  const whatsappSame = !!values.phone && values.phone === values.whatsappNumber;
  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <FormSection title="Photo" description="Shown on your ID card and to the school.">
              <PhotoInput currentUrl={photoUrl} error={e?.photo?.[0]} />
            </FormSection>
            <FormSection title="Contact">
              <Field label="Mobile number" name="phone" errors={e}>
                <MobileInput name="phone" defaultValue={values.phone} />
              </Field>
              <Field label="Email" name="email" errors={e}>
                <input type="email" name="email" defaultValue={values.email ?? ""} className={inputClass} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-fg-2">WhatsApp number</span>
                <SameAs name="whatsappSameAsPhone" label="Same as mobile" initial={whatsappSame} note="Uses the mobile number.">
                  <MobileInput name="whatsappNumber" label="WhatsApp number" defaultValue={values.whatsappNumber} />
                </SameAs>
                {e?.whatsappNumber?.[0] && <span className="mt-1.5 block text-xs font-medium text-danger">{e.whatsappNumber[0]}</span>}
              </div>
              <Field label="Address" name="address" errors={e} className="sm:col-span-2">
                <textarea name="address" rows={2} maxLength={500} defaultValue={values.address ?? ""} className={inputClass} />
              </Field>
            </FormSection>
            <FormSection title="Other details">
              <Field label="Blood group" name="bloodGroup" errors={e}>
                <select name="bloodGroup" defaultValue={values.bloodGroup ?? ""} className={selectClass}>
                  <option value="">Not given</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {BLOOD_GROUP_LABELS[b]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Qualification" name="qualification" errors={e} hint="e.g. M.Sc. Mathematics, B.Ed.">
                <input name="qualification" maxLength={120} defaultValue={values.qualification ?? ""} className={inputClass} />
              </Field>
            </FormSection>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
              <p className="mr-auto text-xs text-muted">Your school admin can see what you change.</p>
              <SubmitButton icon={<Save className="h-4 w-4" />}>Save my details</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
