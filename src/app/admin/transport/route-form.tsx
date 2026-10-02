"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { buttonVariants, FormActions, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Values = {
  routeNumber: string;
  name: string | null;
  vehicleNumber: string;
  vehicleType: string | null;
  driverName: string | null;
  driverPhone: string | null;
  attendantName: string | null;
  attendantPhone: string | null;
  stops: string[];
};

/** A bus or van route: number, vehicle, driver and the stops in order. */
export function RouteForm({ action, values, submitLabel }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; values?: Values; submitLabel: string }) {
  return (
    <ActionForm action={action} className="space-y-6">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Route number" name="routeNumber" errors={e} required>
                <input name="routeNumber" required maxLength={20} defaultValue={values?.routeNumber} placeholder="e.g. R-3" className={inputClass} />
              </Field>
              <Field label="Route name" name="name" errors={e} className="lg:col-span-3">
                <input name="name" maxLength={80} defaultValue={values?.name ?? ""} placeholder="e.g. Civil Lines – Station Road" className={inputClass} />
              </Field>
              <Field label="Vehicle number" name="vehicleNumber" errors={e} required>
                <input name="vehicleNumber" required maxLength={20} defaultValue={values?.vehicleNumber} placeholder="e.g. UP32 AB 1234" className={`${inputClass} uppercase`} />
              </Field>
              <Field label="Vehicle" name="vehicleType" errors={e}>
                <input name="vehicleType" maxLength={40} defaultValue={values?.vehicleType ?? ""} placeholder="e.g. Bus, 40 seats" className={inputClass} />
              </Field>
              <Field label="Driver" name="driverName" errors={e}>
                <input name="driverName" maxLength={60} defaultValue={values?.driverName ?? ""} className={inputClass} />
              </Field>
              <Field label="Driver's phone" name="driverPhone" errors={e}>
                <input name="driverPhone" inputMode="tel" maxLength={15} defaultValue={values?.driverPhone ?? ""} placeholder="10-digit mobile" className={inputClass} />
              </Field>
              <Field label="Attendant" name="attendantName" errors={e} hint="Optional: conductor or helper.">
                <input name="attendantName" maxLength={60} defaultValue={values?.attendantName ?? ""} className={inputClass} />
              </Field>
              <Field label="Attendant's phone" name="attendantPhone" errors={e}>
                <input name="attendantPhone" inputMode="tel" maxLength={15} defaultValue={values?.attendantPhone ?? ""} className={inputClass} />
              </Field>
              <Field label="Stops, in order" name="stops" errors={e} hint="One per line, with the pick-up time if you like, e.g. “Hazratganj (7:10 am)”." className="sm:col-span-2 lg:col-span-4">
                <textarea name="stops" rows={6} defaultValue={values?.stops.join("\n")} className={inputClass} />
              </Field>
            </div>
            <FormActions>
              <Link href="/admin/transport" className={buttonVariants.secondary}>
                Cancel
              </Link>
              <SubmitButton icon={<Save className="h-4 w-4" />}>{submitLabel}</SubmitButton>
            </FormActions>
          </>
        );
      }}
    </ActionForm>
  );
}
