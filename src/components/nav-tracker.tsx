"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Remembers the previous page of this tab (sessionStorage "nav:prev"), so a
 * Back link can go back in history instead of adding another page to it.
 */
export function NavTracker() {
  const path = usePathname();
  useEffect(() => {
    try {
      const current = sessionStorage.getItem("nav:cur");
      if (current === path) return;
      if (current) sessionStorage.setItem("nav:prev", current);
      sessionStorage.setItem("nav:cur", path);
    } catch {
      // Storage blocked: Back links fall back to opening their page.
    }
  }, [path]);
  return null;
}
