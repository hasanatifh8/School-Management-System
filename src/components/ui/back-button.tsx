"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Pages visited in this tab since the app loaded. More than one means the
// browser's previous entry is a page of this app, so going back is safe.
let visited = 0;

/** Counts in-app page visits; mounted once at the root. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    visited++;
  }, [pathname]);
  return null;
}

/**
 * Returns to the page the user came from (e.g. the dashboard), or to
 * `fallback` when the page was opened directly.
 */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (visited > 1 ? router.back() : router.push(fallback))}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-fg-2 shadow-card transition hover:border-line-strong hover:text-accent-text print:hidden"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Back
    </button>
  );
}
