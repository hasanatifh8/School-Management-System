"use client";

import { useActionState, startTransition } from "react";
import { KeyRound, LogIn, Power, Trash2 } from "lucide-react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/forms";
import { CredentialsNotice } from "@/components/credentials-notice";
import { Badge, Card, buttonVariants, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Props = {
  username: string | null;
  hasLogin: boolean;
  enabled: boolean;
  lastLoginAt: string | null;
  issue: () => Promise<ActionState>;
  changeUsername: (state: ActionState, formData: FormData) => Promise<ActionState>;
  setEnabled: (enabled: boolean) => Promise<ActionState>;
  remove: () => Promise<ActionState>;
};

/** School admin's controls for a teacher's portal login. */
export function TeacherLoginCard({ username, hasLogin, enabled, lastLoginAt, issue, changeUsername, setEnabled, remove }: Props) {
  // One action slot for the buttons, so the latest result (and new credentials) shows here.
  const [state, run, pending] = useActionState(
    async (_: ActionState, op: "issue" | "enable" | "disable" | "remove") =>
      op === "issue" ? issue() : op === "remove" ? remove() : setEnabled(op === "enable"),
    {},
  );
  const act = (op: "issue" | "enable" | "disable" | "remove", confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(() => run(op));
  };

  return (
    <Card
      title="Teacher login"
      icon={LogIn}
      description="Lets this teacher sign in to the teacher portal and see their own class."
      action={hasLogin ? enabled ? <Badge tone="green" dot>On</Badge> : <Badge tone="red" dot>Off</Badge> : <Badge>Not set up</Badge>}
    >
      <div className="space-y-4 text-sm">
        {state.credentials ? (
          <CredentialsNotice {...state.credentials} message={state.message} />
        ) : (
          <FormMessage state={state} />
        )}

        {!hasLogin ? (
          <button type="button" disabled={pending} onClick={() => act("issue")} className={buttonVariants.primary}>
            <KeyRound className="h-4 w-4" />
            Create login
          </button>
        ) : (
          <>
            <dl className="space-y-1 text-slate-600">
              <div>
                <dt className="inline text-slate-400">Username: </dt>
                <dd className="inline font-mono text-slate-900">{username}</dd>
              </div>
              <div>
                <dt className="inline text-slate-400">Last sign-in: </dt>
                <dd className="inline">{lastLoginAt ?? "never"}</dd>
              </div>
            </dl>

            <ActionForm action={changeUsername} className="space-y-2">
              <Field label="Change username" name="username">
                <div className="flex gap-2">
                  <input name="username" required defaultValue={username ?? ""} autoCapitalize="none" className={`${inputClass} !py-2 font-mono`} />
                  <SubmitButton variant="secondary" size="sm">
                    Save
                  </SubmitButton>
                </div>
              </Field>
            </ActionForm>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => act("issue", "Create a new password? The teacher will be signed out and must use the new one.")}
                className={`${buttonVariants.secondary} !py-2`}
              >
                <KeyRound className="h-4 w-4" />
                Reset password
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(enabled ? "disable" : "enable", enabled ? "Turn off this teacher's login?" : undefined)}
                className={`${buttonVariants.ghost} !py-2`}
              >
                <Power className="h-4 w-4" />
                {enabled ? "Turn off" : "Turn on"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act("remove", "Remove this login? The teacher can't sign in until you create a new one.")}
                className={`${buttonVariants.dangerGhost} !py-2`}
              >
                <Trash2 className="h-4 w-4" />
                Remove login
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
