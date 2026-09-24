"use client";

import { KeyRound } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/ui";
import { powerLogin } from "../actions";

export function LoginForm() {
  return (
    <ActionForm action={powerLogin} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Power Admin password</span>
        <input type="password" name="password" required autoFocus autoComplete="current-password" className={inputClass} />
      </label>
      <SubmitButton icon={<KeyRound className="h-4 w-4" />}>Sign in</SubmitButton>
    </ActionForm>
  );
}
