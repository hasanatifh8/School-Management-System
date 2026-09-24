// Student admission options and rules shared by the form and the server.
import type { StudentCategory } from "@/generated/prisma/enums";

export const CATEGORY_LABELS: Record<StudentCategory, string> = {
  GENERAL: "General",
  OBC: "OBC",
  SC_ST: "SC/ST",
  MINORITY: "Minority",
};

export const RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Parsi", "Other"] as const;

export const DEFAULT_NATIONALITY = "Indian";

/** Allowed student age range, checked against the date of birth. */
export const MIN_STUDENT_AGE = 2;
export const MAX_STUDENT_AGE = 25;

function yearsAgo(years: number, from = new Date()) {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** Earliest and latest allowed date of birth as YYYY-MM-DD (for `min`/`max` and validation). */
export function dateOfBirthBounds(today = new Date()) {
  return { min: yearsAgo(MAX_STUDENT_AGE, today), max: yearsAgo(MIN_STUDENT_AGE, today) };
}

/**
 * Normalises an Indian mobile number to 10 digits, accepting spaces, dashes and
 * a +91 / 91 / 0 prefix. Returns null when it is not a valid mobile number.
 */
export function normalizeIndianMobile(raw: string): string | null {
  let digits = raw.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
