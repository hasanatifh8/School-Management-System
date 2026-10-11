"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCheck, ListChecks, X } from "lucide-react";
import { Button, useConfirm, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/**
 * Bulk approval for the leave list: rows put a checkbox in the form `id`; this
 * bar shows how many are selected and approves them together.
 */
export function LeaveBulkBar({ id, approve }: { id: string; approve: (ids: string[]) => Promise<ActionState> }) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();
  const boxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=ids][form="${id}"]`)];

  useEffect(() => {
    const sync = () => {
      const all = boxes();
      setTotal(all.length);
      setCount(all.filter((b) => b.checked).length);
    };
    sync();
    document.addEventListener("change", sync);
    // Rows change after an approval refreshes the list.
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("change", sync);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setAll = (checked: boolean) => {
    for (const b of boxes()) b.checked = checked;
    setCount(checked ? boxes().length : 0);
  };

  if (!total) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 sm:px-6">
      <form id={id} onSubmit={(e) => e.preventDefault()} />
      <Button variant="ghost" size="sm" icon={count === total ? X : ListChecks} onClick={() => setAll(count !== total)}>
        {count === total ? "Clear selection" : `Select all ${total} on this page`}
      </Button>
      <span className="text-xs text-muted" aria-live="polite">
        {count ? `${count} selected` : "Tick requests to approve several at once"}
      </span>
      <Button
        size="sm"
        className="ml-auto"
        icon={CheckCheck}
        disabled={!count}
        loading={pending}
        onClick={async () => {
          const ids = boxes()
            .filter((b) => b.checked)
            .map((b) => b.value);
          if (!(await confirm({ title: `Approve ${ids.length} leave request${ids.length === 1 ? "" : "s"}?`, confirmLabel: "Approve" }))) return;
          start(async () => {
            const r = await approve(ids);
            toast(r.ok ? { title: r.message ?? "Approved" } : { title: r.error ?? "Couldn't approve them", tone: "error" });
            if (r.ok) setAll(false);
          });
        }}
      >
        Approve selected{count ? ` (${count})` : ""}
      </Button>
    </div>
  );
}
