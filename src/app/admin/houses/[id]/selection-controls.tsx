"use client";

import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui";

/** "Select all / Clear" buttons and a live count for the `studentIds` checkboxes in the enclosing form. */
export function SelectionControls({ total }: { total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  const boxes = () =>
    Array.from(ref.current?.closest("form")?.querySelectorAll<HTMLInputElement>('input[name="studentIds"]') ?? []);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    // `reset` fires before the fields change, so recount afterwards.
    const onReset = () => setTimeout(update);
    form.addEventListener("change", update);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("change", update);
      form.removeEventListener("reset", onReset);
    };
  }, []);

  function setAll(checked: boolean) {
    for (const b of boxes()) b.checked = checked;
    setCount(checked ? boxes().length : 0);
  }

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-slate-500">
        <span className="font-semibold text-slate-900 tabular-nums">{count}</span> of {total} selected
      </span>
      <div className="flex gap-1">
        <button type="button" onClick={() => setAll(true)} className={`${buttonVariants.ghost} !px-2 !py-1`}>
          Select all
        </button>
        <button type="button" onClick={() => setAll(false)} className={`${buttonVariants.ghost} !px-2 !py-1`}>
          Clear
        </button>
      </div>
    </div>
  );
}
