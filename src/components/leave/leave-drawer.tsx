"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui";

/** Slide-over panel for reviewing one leave request; closing returns to the list without reloading. */
export function LeaveDrawer({ title, description, closeHref, children }: { title: string; description?: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Modal open variant="drawer" title={title} description={description} onClose={() => router.replace(closeHref, { scroll: false })}>
      {children}
    </Modal>
  );
}
