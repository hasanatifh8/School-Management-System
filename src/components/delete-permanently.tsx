"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Button, Modal, inputClass, type ButtonVariant } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Kind = "student" | "teacher" | "staff";

/** What goes and what stays, so the admin knows the effect on their records. */
const EFFECTS: Record<Kind, { deleted: string[]; kept: string[] }> = {
  student: {
    deleted: ["Profile, photo and documents", "Attendance, exam marks and class history", "Fee structure extras (transport, hostel)"],
    kept: ["Fee receipts, with the student's name and ID", "Notices already sent"],
  },
  teacher: {
    deleted: ["Profile, photo and documents", "Teacher portal login"],
    kept: ["Salary payments, with the teacher's name", "Exams, tests and notices they created"],
  },
  staff: {
    deleted: ["Profile, photo and documents", "Cashier sign-in, if any"],
    kept: ["Salary payments, with their name", "Fee receipts they collected"],
  },
};

/**
 * "Delete permanently" for removed people: a button that opens a dialog
 * explaining the effect and asking for the school code.
 */
export function DeletePermanently({
  kind,
  action,
  schoolCode,
  title,
  label = "Delete permanently",
  variant = "dangerGhost",
}: {
  kind: Kind;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  schoolCode: string;
  /** e.g. "Delete 12 removed students?" */
  title: string;
  label?: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const effects = EFFECTS[kind];
  return (
    <>
      <Button variant={variant} size="sm" icon={Trash2} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description="This can't be undone." size="sm">
        {open && (
          <ActionForm action={action} className="space-y-5 p-6">
            {(state) => (
              <>
                <CloseOnSuccess ok={!!state.ok} onClose={() => setOpen(false)} />
                <div className="grid gap-4 text-sm">
                  <div>
                    <p className="mb-1.5 font-medium text-fg">Deleted</p>
                    <ul className="space-y-1">
                      {effects.deleted.map((t) => (
                        <li key={t} className="flex gap-2 text-fg-2">
                          <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 font-medium text-fg">Kept for your records</p>
                    <ul className="space-y-1">
                      {effects.kept.map((t) => (
                        <li key={t} className="flex gap-2 text-fg-2">
                          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Field label={`Type ${schoolCode} to confirm`} name="confirm" errors={state.fieldErrors} required>
                  <input name="confirm" required autoComplete="off" autoFocus placeholder={schoolCode} className={`${inputClass} font-mono uppercase`} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <SubmitButton variant="danger" icon={<Trash2 className="h-4 w-4" />}>
                    {label}
                  </SubmitButton>
                </div>
              </>
            )}
          </ActionForm>
        )}
      </Modal>
    </>
  );
}

function CloseOnSuccess({ ok, onClose }: { ok: boolean; onClose: () => void }) {
  useEffect(() => {
    if (ok) onClose();
  }, [ok, onClose]);
  return null;
}

const PLURAL: Record<Kind, string> = { student: "students", teacher: "teachers", staff: "staff members" };

/** Strip on a list's Removed tab: removed people are kept for history, and can be deleted for good. */
export function RemovedCleanupBar({
  kind,
  count,
  action,
  schoolCode,
}: {
  kind: Kind;
  /** Every removed person of this kind (not just those matching the filters). */
  count: number;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  schoolCode: string;
}) {
  if (!count) return null;
  const noun = count === 1 ? PLURAL[kind].replace(/s$/, "") : PLURAL[kind];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3 text-sm sm:px-6">
      <p className="text-muted">
        Removed {PLURAL[kind]} are kept so their history stays available. Restore anyone from their profile, or delete them for good.
      </p>
      <DeletePermanently kind={kind} action={action} schoolCode={schoolCode} title={`Delete ${count} removed ${noun}?`} label={`Delete all ${count} permanently`} />
    </div>
  );
}
