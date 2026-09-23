"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { buttonVariants, type ButtonVariant } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

export function SubmitButton({
  children,
  variant = "primary",
  confirm,
  icon,
  size = "md",
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  /** Ask the user to confirm before submitting. */
  confirm?: string;
  /** An icon element, e.g. `<Save className="h-4 w-4" />`. */
  icon?: ReactNode;
  size?: "sm" | "md";
}) {
  const { pending: nativePending } = useFormStatus();
  const pending = useContext(PendingContext) || nativePending;
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`${buttonVariants[variant]} ${size === "sm" ? "!px-3 !py-2" : ""}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {pending ? "Saving…" : children}
    </button>
  );
}

export function FormMessage({ state, compact = false }: { state: ActionState; compact?: boolean }) {
  if (compact) {
    if (state.error) return <span role="alert" className="text-xs font-medium text-rose-600">{state.error}</span>;
    if (state.ok && state.message)
      return (
        <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
          <CircleCheck className="h-3.5 w-3.5" />
          {state.message}
        </span>
      );
    return null;
  }
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}

/**
 * A form bound to a server action that reports errors inline.
 *
 * Submits via onSubmit rather than the `action` prop so React does not reset
 * the fields afterwards — otherwise a validation error would wipe the input.
 * After a successful save the form is reset to its (freshly revalidated)
 * default values, so it clears "add" forms and resyncs "edit" forms.
 * Pass `syncKey` derived from server data to also resync when that data is
 * changed by another form on the page.
 * `children` may be a function (from Client Components only) to read field errors.
 */
export function ActionForm({
  action,
  children,
  className = "",
  syncKey,
  compact = false,
}: {
  action: Action;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  syncKey?: string;
  /** Show the result as a small inline note (for one-line forms). */
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    formRef.current?.reset();
  }, [syncKey]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(formData));
      }}
    >
      <PendingContext.Provider value={pending}>
        {typeof children === "function" ? children(state) : children}
      </PendingContext.Provider>
      <FormMessage state={state} compact={compact} />
    </form>
  );
}

export function Field({
  label,
  name,
  errors,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  name: string;
  errors?: ActionState["fieldErrors"];
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const error = errors?.[name]?.[0];
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600">
          <CircleAlert className="h-3.5 w-3.5" />
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}
