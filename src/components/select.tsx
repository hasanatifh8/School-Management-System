"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/**
 * A <select> whose default follows `defaultValue` after the first render.
 *
 * React only applies `defaultValue` to a select when it mounts. Our forms reset
 * to their defaults after a successful save (see ActionForm), so a plain select
 * would jump back to the value from page load instead of the value just saved.
 * This marks the matching option as the default whenever `defaultValue` changes.
 * The effect runs before ActionForm's reset, since child effects run first.
 */
export function Select({ defaultValue, ...props }: ComponentProps<"select">) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const select = ref.current;
    if (!select) return;
    const value = String(defaultValue ?? "");
    for (const option of Array.from(select.options)) option.defaultSelected = option.value === value;
    select.value = value;
  }, [defaultValue]);

  return <select ref={ref} defaultValue={defaultValue} {...props} />;
}
