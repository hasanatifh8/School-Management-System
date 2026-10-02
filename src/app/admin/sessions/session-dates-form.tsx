"use client";

import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, inputClass } from "@/components/ui";
import { updateSessionDates } from "./actions";

/** Start and end dates of one session. A client component so the form can read field errors. */
export function SessionDatesForm({
  session: s,
}: {
  session: { id: string; name: string; status: string; startDate: string; endDate: string };
}) {
  return (
    <ActionForm action={updateSessionDates.bind(null, s.id)} className="rounded-xl border border-line p-4">
      {(state) => (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            {s.name}
            <Badge tone={s.status === "CURRENT" ? "green" : "indigo"}>{s.status === "CURRENT" ? "Current" : "Upcoming"}</Badge>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" name="startDate" errors={state.fieldErrors} required>
              <input type="date" name="startDate" required defaultValue={s.startDate} className={inputClass} />
            </Field>
            <Field label="End date" name="endDate" errors={state.fieldErrors} required>
              <input type="date" name="endDate" required defaultValue={s.endDate} className={inputClass} />
            </Field>
          </div>
          <div className="mt-4">
            <SubmitButton variant="secondary" size="sm" icon={<Save className="h-4 w-4" />}>
              Save dates
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
