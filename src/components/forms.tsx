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
import { buttonClass, type ButtonVariant } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

export function SubmitButton({
  children,
  variant = "primary",
  confirm,
  confirmMessage,
  icon,
  size = "md",
  className,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  /** Ask the user to confirm (in a styled dialog) before submitting. */
  confirm?: string;
  /** Extra detail shown under the confirm question. */
  confirmMessage?: ReactNode;
  /** An icon element, e.g. `<Save className="h-4 w-4" />`. */
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending: nativePending } = useFormStatus();
  const pending = useContext(PendingContext) || nativePending;
  const ask = useConfirm();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (!confirm) return;
        e.preventDefault();
        const button = e.currentTarget;
        ask({
          title: confirm,
          message: confirmMessage,
          tone: variant === "danger" || variant === "dangerGhost" ? "danger" : undefined,
        }).then((ok) => {
          // requestSubmit keeps this button as the submitter (its name/value are sent).
          if (ok) button.form?.requestSubmit(button);
        });
      }}
      className={`${buttonClass({ variant, size })} ${className ?? ""}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function FormMessage({
  state,
  compact = false,
  errorsOnly = false,
}: {
  state: ActionState;
  compact?: boolean;
  /** Success is announced elsewhere (e.g. a toast). */
  errorsOnly?: boolean;
}) {
  if (errorsOnly && !state.error) return null;
  if (compact) {
    if (state.error) return <span role="alert" className="text-xs font-medium text-danger">{state.error}</span>;
    if (state.ok && state.message)
      return (
        <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-success">
          <CircleCheck className="h-3.5 w-3.5" />
          {state.message}
        </span>
      );
    return null;
  }
  if (state.error) {
    return (
      <p role="alert" className="flex animate-rise items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger-line">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="flex animate-rise items-start gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm text-success ring-1 ring-inset ring-success-line">
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
 * A success message is shown as a toast; errors stay next to the form.
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
  const toast = useToast();

  useEffect(() => {
    if (state.error) {
      // Long forms: the inline message may be off-screen. One-line forms show it right beside the button.
      if (!compact) toast({ title: state.error, tone: "error" });
      return;
    }
    if (!state.ok) return;
    formRef.current?.reset();
    if (state.message) toast({ title: state.message });
  }, [state, toast, compact]);

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
      <FormMessage state={state} compact={compact} errorsOnly />
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
      <span className="mb-1.5 block text-sm font-medium text-fg-2">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <CircleAlert className="h-3.5 w-3.5" />
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}
