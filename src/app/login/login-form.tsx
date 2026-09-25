"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/ui";
import { signIn } from "./actions";

type Role = "admin" | "teacher";

export function LoginForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  return (
    <ActionForm action={signIn} className="space-y-4">
      <div role="tablist" aria-label="Sign in as" className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {(["admin", "teacher"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={`rounded-lg py-2 transition ${role === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {r === "admin" ? "School admin" : "Teacher"}
          </button>
        ))}
      </div>
      <input type="hidden" name="role" value={role} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{role === "admin" ? "Email" : "Username"}</span>
        <input
          key={role}
          type={role === "admin" ? "email" : "text"}
          name="identifier"
          required
          autoFocus
          autoCapitalize="none"
          autoComplete="username"
          placeholder={role === "admin" ? "admin@school.edu.in" : "e.g. dps.tch0001"}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
        <input type="password" name="password" required autoComplete="current-password" className={inputClass} />
      </label>
      <SubmitButton icon={<LogIn className="h-4 w-4" />}>Sign in</SubmitButton>
    </ActionForm>
  );
}
