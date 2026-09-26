"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cx } from "./cx";

type Tone = "success" | "error" | "info";
type Toast = { id: number; title: string; description?: string; tone: Tone };
type ToastInput = { title: string; description?: string; tone?: Tone };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Show a short-lived notification: `toast({ title: "Saved" })`. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DURATION = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const toast = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    // Keep at most three on screen.
    setToasts((ts) => [...ts.slice(-2), { id, tone: "success", ...t }]);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end md:bottom-6 print:hidden"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const icons = { success: CircleCheck, error: CircleAlert, info: Info };
const iconTone = { success: "text-success", error: "text-danger", info: "text-accent-text" };

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), DURATION);
    return () => clearTimeout(timer);
  }, [paused, onDismiss, toast.id]);
  const Icon = icons[toast.tone];
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm animate-toast items-start gap-3 rounded-2xl border border-line bg-surface/95 p-4 text-sm shadow-pop backdrop-blur-md"
    >
      <Icon className={cx("mt-0.5 h-5 w-5 shrink-0", iconTone[toast.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-muted">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-m-1 rounded-lg p-1 text-subtle transition hover:bg-surface-3 hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
