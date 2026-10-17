"use client";

import { useActionState, startTransition } from "react";
import { KeyRound, Loader2, Printer } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { buttonVariants } from "@/components/ui";
import type { BulkLoginState } from "@/app/admin/students/login-actions";

/**
 * Creates logins for a section's students who have none, then shows them once
 * as a list to print and hand out (the passwords aren't stored readable).
 */
export function SectionLogins({ create, withLogin, total }: { create: () => Promise<BulkLoginState>; withLogin: number; total: number }) {
  const [state, run, pending] = useActionState<BulkLoginState>(() => create(), {});
  const list = state.list ?? [];
  const missing = total - withLogin;

  return (
    <div className="space-y-4 text-sm">
      {!state.list && (
        <>
          <p className="text-fg-2">
            {withLogin} of {total} students have a login.{" "}
            {missing > 0 ? `Create logins for the other ${missing}: each gets a username and a password to share.` : "Everyone already has one."}
          </p>
          <p className="text-xs text-muted">Students sign in at the same page as staff, choosing Student. Reset or turn off a login from the student&apos;s profile.</p>
          {missing > 0 && (
            <button type="button" disabled={pending} onClick={() => startTransition(() => run())} className={buttonVariants.primary}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Create {missing} login{missing === 1 ? "" : "s"}
            </button>
          )}
        </>
      )}
      <FormMessage state={state.error ? state : list.length ? {} : state} />

      {list.length > 0 && (
        <>
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-fg-2">{state.message}</p>
          {/* Printed on its own: the rest of the page is hidden while printing this dialog. */}
          <div id="section-logins-print" className="overflow-hidden rounded-xl border border-line">
            <p className="hidden px-3 pt-3 text-base font-semibold print:block">Student logins · {state.section}</p>
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Roll</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Username</th>
                  <th className="px-3 py-2 font-medium">Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((s) => (
                  <tr key={s.username}>
                    <td className="px-3 py-2 tabular-nums text-muted">{s.rollNumber ?? "—"}</td>
                    <td className="px-3 py-2 font-medium text-fg">{s.name}</td>
                    <td className="px-3 py-2 font-mono">{s.username}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{s.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <style>{"@media print { body * { visibility: hidden !important; } #section-logins-print, #section-logins-print * { visibility: visible !important; } #section-logins-print { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0; } }"}</style>
          <button type="button" onClick={() => window.print()} className={buttonVariants.secondary}>
            <Printer className="h-4 w-4" />
            Print list
          </button>
        </>
      )}
    </div>
  );
}
