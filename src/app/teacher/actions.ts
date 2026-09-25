"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, optionalText, validationError } from "@/lib/action-state";
import { db } from "@/lib/db";
import { autoAssignRollNumbers, findRollNumberClash, syncCurrentEnrollment } from "@/lib/enrollments";
import { readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import { normalizeIndianMobile } from "@/lib/student-options";
import { findClassStudent, requireTeacher } from "@/lib/teacher-auth";

/** What a class teacher may change on a student: contact details, photo and roll number. */
const classStudentSchema = z
  .object({
    phone: optionalText,
    email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => v || null),
    whatsappNumber: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v?.trim()) return null;
        const mobile = normalizeIndianMobile(v);
        if (!mobile) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
        return mobile ?? z.NEVER;
      }),
    whatsappSameAsPhone: z.literal("on").optional(),
    primaryAddress: optionalText,
    correspondenceAddress: optionalText,
    correspondenceSameAsPrimary: z.literal("on").optional(),
    rollNumber: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 9999) {
          ctx.addIssue({ code: "custom", message: "Roll number must be a whole number from 1" });
          return z.NEVER;
        }
        return n;
      }),
  })
  .transform(({ whatsappSameAsPhone, correspondenceSameAsPrimary, ...data }, ctx) => {
    let whatsappNumber = data.whatsappNumber;
    if (whatsappSameAsPhone) {
      whatsappNumber = data.phone ? normalizeIndianMobile(data.phone) : null;
      if (data.phone && !whatsappNumber) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid 10-digit mobile number to use it for WhatsApp" });
        return z.NEVER;
      }
    }
    return {
      ...data,
      whatsappNumber,
      correspondenceAddress: correspondenceSameAsPrimary ? data.primaryAddress : data.correspondenceAddress,
    };
  });

/** A class teacher updates a student in their own class. */
export async function updateClassStudent(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeacher();
  const student = await findClassStudent(ctx, studentId);
  if (!student || !ctx.classSection) return { error: "You can only edit students in your own class." };

  const parsed = classStudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  const { rollNumber, ...contact } = parsed.data;
  if (rollNumber != null) {
    const clash = await findRollNumberClash(db, ctx.classSection.id, rollNumber, studentId);
    if (clash) {
      const message = `Roll number ${rollNumber} is already used by ${fullName(clash)}`;
      return { error: message, fieldErrors: { rollNumber: [message] } };
    }
  }

  const session = await getCurrentSession(ctx.school.id);
  await db.$transaction(async (tx) => {
    const { photoId, staleId } = await resolvePhotoChange(
      tx,
      ctx.school.id,
      student.photoId,
      upload.photo,
      formData.get("removePhoto") === "on",
    );
    await tx.student.update({ where: { id: studentId }, data: { ...contact, rollNumber, photoId } });
    if (staleId) await tx.photo.delete({ where: { id: staleId } });
    await syncCurrentEnrollment(tx, session.id, studentId, student.sectionId, rollNumber);
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

/** Numbers the teacher's class A–Z from 1, or only students without a number. */
export async function assignMyClassRollNumbers(mode: "all" | "missing"): Promise<ActionState> {
  const ctx = await requireTeacher();
  if (!ctx.classSection) return { error: "You are not a class teacher." };
  const session = await getCurrentSession(ctx.school.id);
  const count = await db.$transaction((tx) => autoAssignRollNumbers(tx, session.id, ctx.classSection!.id, mode), {
    timeout: 30_000,
  });
  revalidatePath("/", "layout");
  if (!count) return { ok: true, message: "Everyone already has a roll number." };
  return { ok: true, message: mode === "all" ? `Numbered ${count} students from 1 (A–Z).` : `Numbered ${count} student(s).` };
}
