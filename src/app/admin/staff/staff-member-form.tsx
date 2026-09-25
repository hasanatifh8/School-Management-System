"use client";

import { Save, UserPlus } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

const JOBS = ["Accountant", "Office assistant", "Receptionist", "Librarian", "Lab assistant", "Security guard", "Peon", "Helper", "Cleaner", "Driver", "Conductor", "Gardener", "Cook", "Nurse", "Electrician"];

type Member = { name: string; designation: string; phone: string | null; monthlySalary: number | null; joiningDate: Date | null };

export function StaffMemberForm({ action, member }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; member?: Member }) {
  return (
    <ActionForm action={action} className="space-y-3">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            <div className={member ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5" : "space-y-3"}>
              <Field label="Name" name="name" errors={e} required>
                <input name="name" defaultValue={member?.name} required className={inputClass} />
              </Field>
              <Field label="Job" name="designation" errors={e} required>
                <input name="designation" list="staff-jobs" defaultValue={member?.designation} required placeholder="e.g. Security guard" className={inputClass} />
              </Field>
              <Field label="Phone" name="phone" errors={e}>
                <input name="phone" type="tel" defaultValue={member?.phone ?? ""} className={inputClass} />
              </Field>
              <Field label="Monthly salary (₹)" name="monthlySalary" errors={e}>
                <input name="monthlySalary" inputMode="numeric" defaultValue={member?.monthlySalary ?? ""} className={inputClass} />
              </Field>
              <Field label="Joined on" name="joiningDate" errors={e}>
                <input name="joiningDate" type="date" defaultValue={member?.joiningDate?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
              </Field>
            </div>
            <datalist id="staff-jobs">
              {JOBS.map((j) => (
                <option key={j} value={j} />
              ))}
            </datalist>
            <SubmitButton size="sm" icon={member ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}>
              {member ? "Save" : "Add to staff"}
            </SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
