import { z } from "zod";
import { isoDate, parseISODate, todayISO } from "@/lib/attendance-shared";
import { normalizeIndianMobile } from "@/lib/student-options";

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

/** Optional <input type="date"> (YYYY-MM-DD): blank becomes null; rejects dates like 31 Feb. */
export const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return null;
    const d = parseISODate(v.trim());
    if (!d || d.getUTCFullYear() < 1900) {
      ctx.addIssue({ code: "custom", message: "Enter a real date" });
      return z.NEVER;
    }
    return d;
  });

/** Optional date that can't be after today (India): blank becomes null. */
export const optionalPastDate = optionalDate.superRefine((d, ctx) => {
  if (d && isoDate(d) > todayISO()) ctx.addIssue({ code: "custom", message: "Date can't be in the future" });
});

// Letters in any script, spaces, dots, apostrophes and hyphens ("D'Souza", "S. K. Rao").
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
const nameMessage = (label: string) => `${label} can only have letters, spaces, dots, apostrophes and hyphens`;

/** Required person's name. */
export const requiredName = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(100, `${label} is too long`).regex(NAME, nameMessage(label));

/** Optional person's name: blank becomes null. */
export const optionalName = (label: string) =>
  z
    .string()
    .trim()
    .max(100, `${label} is too long`)
    .optional()
    .refine((v) => !v || NAME.test(v), nameMessage(label))
    .transform((v) => v || null);

/** Optional Indian mobile number, stored as 10 digits; accepts +91, spaces and dashes. */
export const optionalMobile = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return null;
    const mobile = normalizeIndianMobile(v);
    if (!mobile) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
      return z.NEVER;
    }
    return mobile;
  });

/** Optional landline or mobile number (8–13 digits, may have +, spaces, dashes and brackets). */
export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || (/^\+?[\d\s\-()]+$/.test(v) && /^\d{8,13}$/.test(v.replace(/\D/g, ""))), "Enter a valid phone number, e.g. 011-2345 6789")
  .transform((v) => v || null);

/** Optional email, lower-cased: blank becomes null. */
export const optionalEmail = z
  .union([z.literal(""), z.email("Enter a valid email").trim().toLowerCase()])
  .optional()
  .transform((v) => v || null);

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
