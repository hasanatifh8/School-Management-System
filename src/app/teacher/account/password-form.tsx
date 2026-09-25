"use client";

import { KeyRound } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PasswordField } from "@/components/password-field";
import { changeTeacherPassword } from "../../login/actions";

export function TeacherPasswordForm() {
  return (
    <ActionForm action={changeTeacherPassword} className="max-w-md space-y-4">
      {(state) => (
        <>
          <Field label="Current password" name="currentPassword" errors={state.fieldErrors} required>
            <PasswordField name="currentPassword" autoComplete="current-password" />
          </Field>
          <Field label="New password" name="newPassword" errors={state.fieldErrors} required hint="At least 8 characters with a letter and a number.">
            <PasswordField name="newPassword" generate />
          </Field>
          <Field label="Confirm new password" name="confirmPassword" errors={state.fieldErrors} required>
            <PasswordField name="confirmPassword" />
          </Field>
          <SubmitButton icon={<KeyRound className="h-4 w-4" />}>Change password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
