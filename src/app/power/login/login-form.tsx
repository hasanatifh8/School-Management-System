"use client";

import { KeyRound } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PasswordField } from "@/components/password-field";
import { powerLogin } from "../actions";

export function LoginForm() {
  return (
    <ActionForm action={powerLogin} className="space-y-6">
      <div>
        <span id="power-password" className="mb-1.5 block text-sm font-medium text-fg-2">
          Power Admin password
        </span>
        <PasswordField name="password" autoComplete="current-password" labelledBy="power-password" />
      </div>
      <SubmitButton size="lg" className="w-full" icon={<KeyRound className="h-4 w-4" />}>
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}
