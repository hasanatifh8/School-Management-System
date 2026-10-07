"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui";

/** Announces a fee just collected, once per receipt (not again on reload). */
export function CollectedToast({ receiptId, title, description }: { receiptId: string; title: string; description: string }) {
  const toast = useToast();
  useEffect(() => {
    const key = `collected:${receiptId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: show it anyway.
    }
    toast({ title, description, tone: "success" });
  }, [receiptId, title, description, toast]);
  return null;
}
