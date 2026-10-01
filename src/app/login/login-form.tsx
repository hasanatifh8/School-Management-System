"use client";

import { useState } from "react";
import { LogIn, Presentation, ShieldUser } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PasswordField } from "@/components/password-field";
import { SegmentedControl, inputClass } from "@/components/ui";
import { signIn } from "./actions";

type Role = "admin" | "teacher";

export function LoginForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  return (
    <ActionForm action={signIn} className="space-y-6 lg:short:space-y-4 lg:shorter:space-y-3">
      <SegmentedControl
        name="role"
        label="Sign in as"
        value={role}
        onChange={setRole}
        className="w-full"
        options={[
          { value: "admin", label: "Admin & cashier", icon: ShieldUser },
          { value: "teacher", label: "Teacher", icon: Presentation },
        ]}
      />
      <Field label={role === "admin" ? "Email" : "Username"} name="identifier">
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
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-fg-2" id="password-label">
          Password
        </span>
        <PasswordField name="password" autoComplete="current-password" labelledBy="password-label" />
      </div>
      <SubmitButton
        size="lg"
        className="w-full bg-gradient-to-r from-[#1e1652] via-[#2b1d6e] to-[#1a1240] py-3.5 text-base lg:shorter:py-2.5 shadow-[0_10px_30px_-8px_rgb(91_78_232/0.6)] ring-1 ring-white/10 hover:brightness-125"
        icon={<LogIn className="h-4 w-4" />}
      >
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}
