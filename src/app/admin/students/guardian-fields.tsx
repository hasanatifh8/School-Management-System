"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/forms";
import { Select } from "@/components/select";
import { inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { GUARDIAN_RELATIONS } from "@/lib/student-options";

/**
 * Guardian name, plus their relation to the student once a name is typed.
 * Follows the form's reset after a save.
 */
export function GuardianFields({
  name,
  relation,
  errors,
}: {
  name: string;
  relation: string;
  errors?: ActionState["fieldErrors"];
}) {
  const [hasName, setHasName] = useState(!!name);
  const [shownName, setShownName] = useState(name);
  const nameRef = useRef(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Saved data changed (e.g. after a save): follow it.
  if (name !== shownName) {
    setShownName(name);
    setHasName(!!name);
  }

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setHasName(!!nameRef.current);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Guardian's name" name="guardianName" errors={errors}>
        <input
          ref={inputRef}
          name="guardianName"
          maxLength={100}
          placeholder="Full name"
          defaultValue={name}
          onInput={(e) => setHasName(!!e.currentTarget.value.trim())}
          className={inputClass}
        />
      </Field>
      {hasName && (
        <Field label="Relation with student" name="guardianRelation" errors={errors} required>
          <Select name="guardianRelation" defaultValue={relation} required className={selectClass}>
            <option value="">Select relation</option>
            {GUARDIAN_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}
