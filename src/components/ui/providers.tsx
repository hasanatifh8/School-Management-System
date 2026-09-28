"use client";

import type { ReactNode } from "react";
import { NavigationTracker } from "./back-button";
import { ConfirmProvider } from "./modal";
import { ToastProvider } from "./toast";

/** App-wide toast and confirm-dialog hosts, and the page-visit count for Back buttons. */
export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <NavigationTracker />
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
