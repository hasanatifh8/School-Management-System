"use client";

import { useActionState, useState, type ReactNode } from "react";
import { History, Save } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Button, Modal, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type MarkOption = { value: string; label: string; short: string; on: string };

/**
 * A register cell that opens a small editor: pick the new status and give a
 * reason (required, kept in the change log).
 */
export function MarkEditor({
  options,
  current,
  title,
  fields,
  action,
  children,
  className,
}: {
  options: MarkOption[];
  current: string | null;
  /** e.g. "Asha Rao · 3 Oct 2026" */
  title: string;
  /** Hidden fields sent with the edit (ids and date). */
  fields: Record<string, string>;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [status, setStatus] = useState(current ?? "");
  const [state, formAction, saving] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast({ title: result.message ?? "Attendance changed" });
    }
    return result;
  }, {});

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus(current ?? "");
          setOpen(true);
        }}
        title={`Change ${title}`}
        className={`block h-full w-full rounded transition hover:ring-2 hover:ring-inset hover:ring-accent/40 focus-visible:outline-2 focus-visible:outline-accent ${className ?? ""}`}
      >
        {children}
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} size="sm" title="Change attendance" description={title}>
          <form action={formAction} className="space-y-4 px-6 py-5">
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg-2">Mark as</legend>
              <div role="radiogroup" className="flex flex-wrap gap-1.5">
                {options.map((o) => {
                  const on = status === o.value;
                  return (
                    <label
                      key={o.value}
                      className={`flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                        on ? `${o.on} shadow-card` : "bg-surface text-muted ring-line hover:bg-surface-2 hover:text-fg"
                      }`}
                    >
                      <input type="radio" name="status" value={o.value} checked={on} onChange={() => setStatus(o.value)} className="sr-only" />
                      {o.short} <span className="font-medium">{o.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-fg-2">
                Reason for the change <span className="text-danger">*</span>
              </span>
              <textarea
                name="note"
                required
                minLength={3}
                maxLength={200}
                rows={2}
                placeholder="e.g. Came in after the register was taken"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 sm:text-sm"
              />
              <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                <History className="h-3.5 w-3.5" aria-hidden /> Saved in the change log with your name.
              </span>
            </label>
            <FormMessage state={state} compact />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" icon={Save} loading={saving} disabled={!status || status === current}>
                Save change
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
