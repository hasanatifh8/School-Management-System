"use client";

import { useState, type ReactNode } from "react";
import { Modal, buttonClass, type ButtonVariant } from "@/components/ui";

/** A button that opens its content (usually a form) in a dialog, or a side drawer. */
export function DialogButton({
  label,
  icon,
  title,
  description,
  variant = "secondary",
  drawer = false,
  children,
}: {
  label: ReactNode;
  /** An icon element, e.g. `<Plus className="h-4 w-4" />` (server pages can't pass the component itself). */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  variant?: ButtonVariant;
  drawer?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass({ variant, size: "sm" })}>
        {icon}
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} variant={drawer ? "drawer" : "center"} size="sm">
        {open && <div className="p-6">{children}</div>}
      </Modal>
    </>
  );
}
