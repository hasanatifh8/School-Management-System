"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Button } from "./button";
import { cx } from "./cx";

/**
 * Accessible modal built on the native <dialog>: focus is trapped, Esc closes,
 * and clicking the backdrop closes. `variant="drawer"` slides in from the right.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  variant = "center",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "center" | "drawer" | "drawer-left";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const width = { sm: "w-[min(26rem,calc(100vw-2rem))]", md: "w-[min(36rem,calc(100vw-2rem))]", lg: "w-[min(48rem,calc(100vw-2rem))]" }[size];
  const shape =
    variant === "center"
      ? cx("m-auto max-h-[85dvh] rounded-2xl", width)
      : variant === "drawer"
        ? "my-0 ml-auto mr-0 h-dvh max-h-none w-[min(28rem,100vw)] rounded-l-2xl"
        : "my-0 ml-0 mr-auto h-dvh max-h-none w-[min(20rem,85vw)] rounded-r-2xl";

  return (
    <dialog
      ref={ref}
      data-variant={variant === "center" ? undefined : variant}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={typeof title === "string" ? title : undefined}
      className={cx("flex-col border border-line bg-surface p-0 text-fg shadow-pop open:flex", shape)}
    >
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-lg p-1.5 text-subtle transition hover:bg-surface-3 hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">{footer}</footer>}
    </dialog>
  );
}

/* ───────────────────────── Confirm ───────────────────────── */

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
};

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

/** `if (await confirm({ title: "Delete X?", tone: "danger" })) …` — a styled replacement for window.confirm. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

const VERBS = ["Create", "Delete", "Remove", "Cancel", "Suspend", "Disable", "Stop", "Reset", "Restore", "Promote", "Start", "Send", "Clear", "Mark", "Archive", "Close", "Undo", "Finish", "Publish", "Unpublish", "Revoke", "Replace"];

/** "Delete Class 5?" → "Delete". Falls back to "Continue". */
export function verbOf(text: string) {
  const first = text.trim().split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "") ?? "";
  return VERBS.includes(first) ? first : "Continue";
}

const DANGER = /^(Delete|Remove|Cancel|Suspend|Disable|Revoke|Permanently|Clear)\b/;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(ok: boolean) => void>(undefined);

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function finish(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = undefined;
    setOpts(null);
  }

  const danger = opts ? (opts.tone ?? (DANGER.test(opts.title) ? "danger" : "default")) === "danger" : false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => finish(false)} size="sm">
        {opts && (
          <div className="p-6">
            <div className="flex items-start gap-4">
              <span
                className={cx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  danger ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-text",
                )}
              >
                <TriangleAlert className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 pt-1">
                <h2 className="text-base font-semibold text-fg">{opts.title}</h2>
                {opts.message && <div className="mt-1 text-sm text-muted">{opts.message}</div>}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => finish(false)} autoFocus={danger}>
                Go back
              </Button>
              <Button variant={danger ? "danger" : "primary"} onClick={() => finish(true)} autoFocus={!danger}>
                {opts.confirmLabel ?? verbOf(opts.title)}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
