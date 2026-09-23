"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { type ActionState, requiredText, validationError } from "@/lib/action-state";

const subjectSchema = z.object({
  name: requiredText("Subject name"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,10}$/, "2–10 letters, digits or dashes"),
});

export async function createSubject(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = subjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { name, code } = parsed.data;

  if (await db.subject.findFirst({ where: { schoolId: school.id, code } })) {
    return { error: `A subject with code ${code} already exists.` };
  }
  await db.subject.create({ data: { schoolId: school.id, name, code } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Added ${name}. Add it to classes from each class's page.` };
}

export async function deleteSubject(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const subject = await db.subject.findFirst({ where: { id, schoolId: school.id } });
  if (!subject) return { error: "Subject not found." };

  const students = await db.studentSubject.count({ where: { subjectId: id } });
  if (students) {
    return {
      error: `${students} student(s) have ${subject.name} allotted. Remove it from their classes (with “update students” ticked) first.`,
    };
  }
  // Also removes it from class curricula and subject-teacher assignments.
  await db.subject.delete({ where: { id } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Deleted ${subject.name}.` };
}
