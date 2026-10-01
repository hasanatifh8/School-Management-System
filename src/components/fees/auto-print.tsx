"use client";

import { useEffect } from "react";

/** Opens the print dialog once the page has loaded (pages opened with ?print=1). */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400); // let the logo and fonts load
    return () => clearTimeout(t);
  }, []);
  return null;
}
