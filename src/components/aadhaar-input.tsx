"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/ui";
import { formatAadhaar } from "@/lib/document-types";

/**
 * Aadhaar number field: accepts digits only and shows them as 1234-5678-9012
 * while typing or pasting. Follows the form's reset after a save.
 */
export function AadhaarInput({
  name,
  defaultValue,
  id,
}: {
  name: string;
  defaultValue?: string | null;
  id?: string;
}) {
  const initial = formatAadhaar(defaultValue ?? "");
  const [value, setValue] = useState(initial);
  const [shownInitial, setShownInitial] = useState(initial);
  const initialRef = useRef(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // A save can change the stored value: show the new one.
  if (initial !== shownInitial) {
    setShownInitial(initial);
    setValue(initial);
  }

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setValue(initialRef.current);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      value={value}
      onChange={(e) => setValue(formatAadhaar(e.target.value))}
      inputMode="numeric"
      autoComplete="off"
      maxLength={14}
      placeholder="1234-5678-9012"
      pattern="\d{4}-\d{4}-\d{4}"
      title="12 digits, e.g. 1234-5678-9012"
      className={`${inputClass} font-mono tracking-wide`}
    />
  );
}
