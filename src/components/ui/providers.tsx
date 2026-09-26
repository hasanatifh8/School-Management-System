"use client";

import type { ReactNode } from "react";
import { ConfirmProvider } from "./modal";
import { ToastProvider } from "./toast";

/** App-wide toast and confirm-dialog hosts. */
export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
