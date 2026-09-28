"use client";

import { useActionState, startTransition } from "react";
import { KeyRound, Power, Trash2, Wallet } from "lucide-react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/forms";
import { CredentialsNotice } from "@/components/credentials-notice";
import { Badge, Card, buttonVariants, inputClass, useConfirm } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Props = {
  name: string;
  email: string | null;
  removed: boolean;
  account: { email: string; active: boolean; lastLoginAt: string | null } | null;
  make: (state: ActionState, formData: FormData) => Promise<ActionState>;
  reset: () => Promise<ActionState>;
  setActive: (active: boolean) => Promise<ActionState>;
  remove: () => Promise<ActionState>;
};

/**
 * Cashier access for a staff member: a sign-in that sees only Fees (collecting
 * payments and receipts). Staff who aren't cashiers have no login at all.
 */
export function CashierCard({ name, email, removed, account, make, reset, setActive, remove }: Props) {
  // One action slot for the buttons, so the latest result (and a new password) shows here.
  const [state, run, pending] = useActionState(
    async (_: ActionState, op: "reset" | "on" | "off" | "remove") => (op === "reset" ? reset() : op === "remove" ? remove() : setActive(op === "on")),
    {},
  );
  const confirm = useConfirm();
  const act = async (op: "reset" | "on" | "off" | "remove", title?: string) => {
    if (title && !(await confirm({ title }))) return;
    startTransition(() => run(op));
  };

  return (
    <Card
      title="Cashier access"
      icon={Wallet}
      description="A cashier can sign in and collect fees. Nothing else in the app is open to them."
      action={account ? account.active ? <Badge tone="green" dot>Cashier</Badge> : <Badge tone="red" dot>Off</Badge> : <Badge>No login</Badge>}
    >
      <div className="space-y-4 text-sm">
        {state.credentials ? <CredentialsNotice {...state.credentials} message={state.message} /> : <FormMessage state={state} />}

        {!account ? (
          removed ? (
            <p className="text-muted">Restore this staff member to make them a cashier.</p>
          ) : (
            <ActionForm action={make} className="space-y-3">
              {(s) =>
                s.credentials ? (
                  <CredentialsNotice {...s.credentials} message={s.message} />
                ) : (
                  <>
                    <p className="text-muted">{name} has no login. Make them a cashier to let them collect fees at the office.</p>
                    <Field label="Sign-in email" name="email" errors={s.fieldErrors} required>
                      <input type="email" name="email" required defaultValue={email ?? ""} autoComplete="off" placeholder="name@example.com" className={inputClass} />
                    </Field>
                    <SubmitButton icon={<Wallet className="h-4 w-4" />}>Make cashier</SubmitButton>
                  </>
                )
              }
            </ActionForm>
          )
        ) : (
          <>
            <dl className="space-y-1 text-fg-2">
              <div>
                <dt className="inline text-subtle">Signs in with: </dt>
                <dd className="inline break-all font-mono text-fg">{account.email}</dd>
              </div>
              <div>
                <dt className="inline text-subtle">Last sign-in: </dt>
                <dd className="inline">{account.lastLoginAt ?? "never"}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">To change the sign-in email, edit the email in the profile.</p>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => act("reset", "Create a new password? They will be signed out and must use the new one.")}
                className={`${buttonVariants.secondary} !py-2`}
              >
                <KeyRound className="h-4 w-4" />
                Reset password
              </button>
              {!removed && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(account.active ? "off" : "on", account.active ? `Turn off ${name}'s sign-in?` : undefined)}
                  className={`${buttonVariants.ghost} !py-2`}
                >
                  <Power className="h-4 w-4" />
                  {account.active ? "Turn off" : "Turn on"}
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => act("remove", `Take cashier access away from ${name}? Receipts they issued are kept.`)}
                className={`${buttonVariants.dangerGhost} !py-2`}
              >
                <Trash2 className="h-4 w-4" />
                Remove cashier
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
