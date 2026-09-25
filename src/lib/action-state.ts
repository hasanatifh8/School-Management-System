import { z } from "zod";

/** Result returned by server actions used with `useActionState`. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** New login details to show once (the password is never stored in plain text). */
  credentials?: { username: string; password: string };
  /** Where to continue after showing `credentials`. */
  next?: string;
};

export function validationError(error: z.ZodError): ActionState {
  return {
    error: "Please fix the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as ActionState["fieldErrors"],
  };
}

/** Required text input. */
export const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(200);

/** Optional text input: blank becomes null. */
export const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null);

/** Optional <input type="date">: blank becomes null. */
export const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

export const optionalBloodGroup = z
  .enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", ""])
  .optional()
  .transform((v) => v || null);

export const optionalGender = z
  .enum(["MALE", "FEMALE", "OTHER", ""])
  .optional()
  .transform((v) => v || null);

/** Format a Date for an <input type="date"> value. */
export function toDateInput(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}
