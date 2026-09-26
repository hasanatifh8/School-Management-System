"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** ← / → open the previous / next report card; Esc goes back to the list. Ignored while typing. */
export function CardKeys({ prev, next, list }: { prev: string | null; next: string | null; list: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft" && prev) router.push(prev, { scroll: false });
      else if (e.key === "ArrowRight" && next) router.push(next, { scroll: false });
      else if (e.key === "Escape") router.push(list);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prev, next, list]);
  return null;
}
