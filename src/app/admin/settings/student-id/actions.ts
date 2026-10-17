"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { STUDENT_ID_DIGITS } from "@/lib/codes";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { logged } from "@/lib/activity";

const schema = z.object({
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Enter a prefix.")
    .max(10, "Keep the prefix to 10 characters or fewer.")
    .regex(/^[A-Z0-9]+$/, "Use only letters and numbers in the prefix."),
  digits: z.coerce.number().refine((n) => (STUDENT_ID_DIGITS as readonly number[]).includes(n), "Pick the number of digits."),
});

/** Sets how new student IDs look: <prefix>-<admission year>-<number>. Existing IDs don't change. */
export async function saveStudentIdFormat(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { prefix, digits } = parsed.data;
  await db.school.update({ where: { id: school.id }, data: { studentIdPrefix: prefix, studentIdDigits: digits } });
  revalidatePath("/admin/settings/student-id");
  return logged("Settings", { ok: true, message: "Saved. New admissions get IDs in this format." }, `Student ID format set to ${prefix}-YYYY-${"0".repeat(digits)}`);
}
