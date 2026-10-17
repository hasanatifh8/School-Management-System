"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, Send } from "lucide-react";
import { buttonVariants, useConfirm, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/**
 * Publish a section's results from its results page (or unpublish them). Publishing
 * needs every mark entered; it locks the marks and opens the report cards.
 */
export function PublishResultsButton({
  published,
  missing,
  section,
  publish,
  unpublish,
}: {
  published: boolean;
  /** Students whose marks are still incomplete. */
  missing: number;
  section: string;
  publish: () => Promise<ActionState>;
  unpublish: () => Promise<ActionState>;
}) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const run = (action: () => Promise<ActionState>, done: string) =>
    start(async () => {
      const r = await action();
      toast(r.ok ? { title: r.message ?? done } : { title: r.error ?? "Something went wrong", tone: "error" });
      if (r.ok) router.refresh();
    });

  if (published) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!(await confirm({ title: `Unpublish results for ${section}?`, message: "Marks become editable again and report cards are hidden until you publish again.", confirmLabel: "Unpublish" }))) return;
          run(unpublish, "Results unpublished");
        }}
        className={buttonVariants.ghost}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
        Unpublish
      </button>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending || missing > 0}
        title={missing ? `Marks are still missing for ${missing} student${missing === 1 ? "" : "s"}` : undefined}
        onClick={async () => {
          if (!(await confirm({ title: `Publish results for ${section}?`, message: "Marks will be locked; report cards become available to teachers, students and parents.", confirmLabel: "Publish" }))) return;
          run(publish, "Results published");
        }}
        className={buttonVariants.primary}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Publish results
      </button>
      {missing > 0 && <span className="text-xs text-warning">{missing} student{missing === 1 ? "" : "s"} still need marks</span>}
    </span>
  );
}
