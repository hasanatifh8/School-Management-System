"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { checkboxClass } from "@/components/ui";

/**
 * A "Same as …" checkbox. While ticked it replaces `children` with a note, and
 * the server copies the other field. Follows the form's reset after a save.
 */
export function SameAs({
  name,
  label,
  initial,
  note,
  children,
}: {
  name: string;
  label: string;
  initial: boolean;
  note: string;
  children: ReactNode;
}) {
  const [checked, setChecked] = useState(initial);
  const [shownInitial, setShownInitial] = useState(initial);
  const initialRef = useRef(initial);
  const boxRef = useRef<HTMLInputElement>(null);

  // Saved data changed (e.g. after a save): follow it.
  if (initial !== shownInitial) {
    setShownInitial(initial);
    setChecked(initial);
  }

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  // form.reset() restores a checkbox to its *default* tick, which React only
  // sets once on mount. Keep the default equal to the state so a reset can't
  // leave the tick out of step with what is shown.
  useEffect(() => {
    if (boxRef.current) boxRef.current.defaultChecked = checked;
  }, [checked]);

  useEffect(() => {
    const form = boxRef.current?.form;
    if (!form) return;
    const onReset = () => setChecked(initialRef.current);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <>
      {checked ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
          {note}
        </p>
      ) : (
        children
      )}
      <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input
          ref={boxRef}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className={checkboxClass}
        />
        {label}
      </label>
    </>
  );
}
