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
    <ActionForm action={signIn} className="space-y-6">
      <SegmentedControl
        name="role"
        label="Sign in as"
        value={role}
        onChange={setRole}
        className="w-full"
        options={[
          { value: "admin", label: "School admin", icon: ShieldUser },
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
      <SubmitButton size="lg" className="w-full" icon={<LogIn className="h-4 w-4" />}>
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}
