"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Trash2, X } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { buttonVariants, inputClass, useConfirm, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Decide = (approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;

/** Approve, or reject with a reason, one pending leave request. */
export function LeaveDecision({ name, decide }: { name: string; decide: Decide }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const toast = useToast();

  const run = (approve: boolean) =>
    start(async () => {
      const fd = new FormData();
      fd.set("note", note);
      const r = await decide(approve, {}, fd);
      setState(r);
      if (r.ok) toast({ title: r.message ?? "Saved" });
    });

  if (rejecting) {
    return (
      <div className="w-full space-y-2 sm:w-72">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={`Why is ${name.split(" ")[0]}'s leave rejected?`}
          aria-label="Reason for rejecting"
          className={inputClass}
        />
        <div className="flex gap-2">
          <button type="button" disabled={pending || !note.trim()} onClick={() => run(false)} className={`${buttonVariants.danger} !py-1.5 text-xs`}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Reject
          </button>
          <button type="button" onClick={() => setRejecting(false)} className={`${buttonVariants.ghost} !py-1.5 text-xs`}>
            Cancel
          </button>
        </div>
        <FormMessage state={state} compact />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => run(true)} className={`${buttonVariants.primary} !py-1.5 text-xs`}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve
        </button>
        <button type="button" disabled={pending} onClick={() => setRejecting(true)} className={`${buttonVariants.secondary} !py-1.5 text-xs`}>
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
      <FormMessage state={state} compact />
    </div>
  );
}

/** Withdraw (pending, own) or delete (admin) a request. */
export function LeaveWithdraw({ label, withdraw }: { label: string; withdraw: () => Promise<ActionState> }) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      title={label}
      aria-label={label}
      onClick={async () => {
        if (!(await confirm({ title: `${label}?`, tone: "danger", confirmLabel: label }))) return;
        start(async () => {
          const r = await withdraw();
          toast(r.ok ? { title: r.message ?? "Done" } : { title: r.error ?? "Couldn't remove it", tone: "error" });
        });
      }}
      className="rounded-lg p-2 text-subtle transition hover:bg-danger-soft hover:text-danger"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
