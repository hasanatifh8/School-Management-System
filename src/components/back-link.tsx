"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * A Back link that really goes back when the previous page of this tab is
 * `href` (so the browser's own Back button doesn't then bounce between the two
 * pages), and otherwise opens `href` in place of this page.
 */
export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        let previous: string | null = null;
        try {
          previous = sessionStorage.getItem("nav:prev");
        } catch {}
        const target = new URL(href, window.location.origin).pathname;
        if (previous === target && window.history.length > 1) router.back();
        else router.replace(href);
      }}
    >
      {children}
    </a>
  );
}
