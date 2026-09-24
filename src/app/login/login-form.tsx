"use client";

import { LogIn } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/ui";
import { adminLogin } from "./actions";

export function AdminLoginForm() {
  return (
    <ActionForm action={adminLogin} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
        <input type="email" name="email" required autoFocus autoComplete="username" className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
        <input type="password" name="password" required autoComplete="current-password" className={inputClass} />
      </label>
      <SubmitButton icon={<LogIn className="h-4 w-4" />}>Sign in</SubmitButton>
    </ActionForm>
  );
}
