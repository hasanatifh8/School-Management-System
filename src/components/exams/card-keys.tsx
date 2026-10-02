"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * ← / → open the previous / next report card; Esc goes back to the list. Ignored while
 * typing. They replace the current view, so the browser's Back leaves the results.
 */
export function CardKeys({ prev, next, list }: { prev: string | null; next: string | null; list: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft" && prev) router.replace(prev, { scroll: false });
      else if (e.key === "ArrowRight" && next) router.replace(next, { scroll: false });
      else if (e.key === "Escape") router.replace(list);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prev, next, list]);
  return null;
}
