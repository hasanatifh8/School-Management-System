"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, optionalBloodGroup, optionalEmail, optionalMobile, optionalText, validationError } from "@/lib/action-state";
import { weeklyOffOn } from "@/lib/attendance";
import { parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { onLeave } from "@/lib/leave";
import { autoAssignRollNumbers, findRollNumberClash, syncCurrentEnrollment } from "@/lib/enrollments";
import { readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import { findClassStudent, requireTeacher } from "@/lib/teacher-auth";
import { logged } from "@/lib/activity";

/** What a class teacher may change on a student: contact details, photo and roll number. */
const classStudentSchema = z
  .object({
    phone: optionalMobile,
    email: optionalEmail,
    whatsappNumber: optionalMobile,
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
  .transform(({ whatsappSameAsPhone, correspondenceSameAsPrimary, ...data }) => {
    return {
      ...data,
      whatsappNumber: whatsappSameAsPhone ? data.phone : data.whatsappNumber,
      correspondenceAddress: correspondenceSameAsPrimary ? data.primaryAddress : data.correspondenceAddress,
    };
  });

/** A class teacher updates a student in their own class. */
export async function updateClassStudent(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeacher();
  const student = await findClassStudent(ctx, studentId);
  if (!student || !student.sectionId) return { error: "You can only edit students in your own class." };

  const parsed = classStudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  const { rollNumber, ...contact } = parsed.data;
  if (rollNumber != null) {
    const clash = await findRollNumberClash(db, student.sectionId, rollNumber, studentId);
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
  return logged("Students", { ok: true, message: "Saved." }, `Updated student ${fullName(student)}'s contact details`);
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
  return logged("Attendance", { ok: true, message: mode === "all" ? `Numbered ${count} students from 1 (A–Z).` : `Numbered ${count} student(s).` });
}

/** A teacher marks themselves present for today, unless the office has already marked them or they are on approved leave. */
export async function selfCheckIn(): Promise<ActionState> {
  const ctx = await requireTeacher();
  const today = todayISO();
  const date = parseISODate(today)!;
  const existing = await db.staffAttendance.findUnique({ where: { teacherId_date: { teacherId: ctx.teacher.id, date } } });
  if (existing) return { error: "Today's attendance is already marked." };
  const off = await weeklyOffOn(ctx.school.id, today);
  if (off) return { error: `Today is a ${off}, a weekly off. No attendance is taken.` };
  if ((await onLeave(ctx.school.id, date)).has(ctx.teacher.id)) return { error: "You are on approved leave today." };
  await db.staffAttendance.create({
    data: { schoolId: ctx.school.id, date, teacherId: ctx.teacher.id, status: "PRESENT", markedBy: `${fullName(ctx.teacher)} (self check-in)` },
  });
  revalidatePath("/", "layout");
  return logged("Attendance", { ok: true, message: "Checked in. Have a good day!" }, "Checked in (self check-in)");
}

/** What a teacher may change on their own profile; the rest is kept by the school admin. */
const myProfileSchema = z
  .object({
    phone: optionalMobile,
    whatsappNumber: optionalMobile,
    whatsappSameAsPhone: z.literal("on").optional(),
    email: optionalEmail,
    address: optionalText,
    bloodGroup: optionalBloodGroup,
    qualification: z
      .string()
      .trim()
      .max(120, "Keep it under 120 letters")
      .optional()
      .transform((v) => v || null),
  })
  .transform(({ whatsappSameAsPhone, ...data }) => ({ ...data, whatsappNumber: whatsappSameAsPhone ? data.phone : data.whatsappNumber }));

const PROFILE_FIELD_LABELS = { phone: "phone", whatsappNumber: "WhatsApp number", email: "email", address: "address", bloodGroup: "blood group", qualification: "qualification" } as const;

/** A teacher updates their own contact details, blood group, qualification and photo. */
export async function updateMyProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeacher();
  const parsed = myProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };
  const data = parsed.data;

  // Each teacher needs their own phone number and email (as on the admin's teacher form).
  const others = { schoolId: ctx.school.id, id: { not: ctx.teacher.id } };
  const [byPhone, byEmail] = await Promise.all([
    data.phone ? db.teacher.findFirst({ where: { ...others, phone: data.phone }, select: { id: true } }) : null,
    data.email ? db.teacher.findFirst({ where: { ...others, email: { equals: data.email, mode: "insensitive" } }, select: { id: true } }) : null,
  ]);
  const fieldErrors: Record<string, string[]> = {};
  if (byPhone) fieldErrors.phone = ["Another teacher already uses this number"];
  if (byEmail) fieldErrors.email = ["Another teacher already uses this email"];
  if (Object.keys(fieldErrors).length) return { error: "Use your own phone number and email.", fieldErrors };

  const before = ctx.teacher;
  const changed = (Object.keys(PROFILE_FIELD_LABELS) as (keyof typeof PROFILE_FIELD_LABELS)[]).filter((k) => (before[k] ?? null) !== (data[k] ?? null));
  const removePhoto = formData.get("removePhoto") === "on";
  await db.$transaction(async (tx) => {
    const { photoId, staleId } = await resolvePhotoChange(tx, ctx.school.id, before.photoId, upload.photo, removePhoto);
    await tx.teacher.update({ where: { id: before.id }, data: { ...data, photoId } });
    if (staleId) await tx.photo.delete({ where: { id: staleId } });
  });
  revalidatePath("/", "layout");
  const what = [...changed.map((k) => PROFILE_FIELD_LABELS[k]), ...(upload.photo || removePhoto ? ["photo"] : [])];
  if (!what.length) return { ok: true, message: "Nothing changed." };
  return logged("Teachers", { ok: true, message: "Your profile is saved." }, `${fullName(before)} updated their own ${what.join(", ")}`);
}
