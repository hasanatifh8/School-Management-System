"use client";

import { Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonVariants.primary}>
      <Printer className="h-4 w-4" />
      Print receipt
    </button>
  );
}
