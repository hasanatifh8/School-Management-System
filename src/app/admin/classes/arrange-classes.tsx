"use client";

import { useState } from "react";
import { ArrowDownWideNarrow, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonClass } from "@/components/ui";
import { reorderClasses } from "./actions";

type ClassItem = { id: string; name: string };

const byNumber = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Reorder the school's classes: drag a row, or use its arrows. */
export function ArrangeClasses({ classes }: { classes: ClassItem[] }) {
  const [order, setOrder] = useState(classes);
  const [dragging, setDragging] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <ActionForm action={reorderClasses} keepValues className="space-y-4">
      <button
        type="button"
        onClick={() => setOrder((list) => [...list].sort((a, b) => byNumber.compare(a.name, b.name)))}
        className={buttonClass({ variant: "secondary", size: "sm" })}
      >
        <ArrowDownWideNarrow className="h-4 w-4" />
        Sort by class number
      </button>
      <ol className="space-y-2">
        {order.map((c, i) => (
          <li
            key={c.id}
            draggable
            onDragStart={() => setDragging(i)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragging === null || dragging === i) return;
              move(dragging, i);
              setDragging(i);
            }}
            className={`flex items-center gap-2 rounded-lg border bg-surface px-2 py-2 text-sm transition ${
              dragging === i ? "border-accent-line bg-accent-soft/60 opacity-70" : "border-line"
            }`}
          >
            <input type="hidden" name="ids" value={c.id} />
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-subtle" aria-hidden />
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-subtle">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{c.name}</span>
            <button
              type="button"
              onClick={() => move(i, i - 1)}
              disabled={i === 0}
              aria-label={`Move ${c.name} up`}
              className="rounded-md p-1.5 text-muted transition hover:bg-surface-3 hover:text-fg disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => move(i, i + 1)}
              disabled={i === order.length - 1}
              aria-label={`Move ${c.name} down`}
              className="rounded-md p-1.5 text-muted transition hover:bg-surface-3 hover:text-fg disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
      <SubmitButton>Save order</SubmitButton>
    </ActionForm>
  );
}
