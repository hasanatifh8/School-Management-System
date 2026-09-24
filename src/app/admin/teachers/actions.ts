"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextTeacherCode } from "@/lib/codes";
import { getCurrentSchool } from "@/lib/school";
import { createPhoto, readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import {
  type ActionState,
  optionalDate,
  optionalBloodGroup,
  optionalGender,
  optionalText,
  requiredText,
  validationError,
} from "@/lib/action-state";

const teacherSchema = z.object({
  firstName: requiredText("First name"),
  middleName: optionalText,
  lastName: requiredText("Last name"),
  gender: optionalGender,
  bloodGroup: optionalBloodGroup,
  email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => v || null),
  phone: optionalText,
  qualification: optionalText,
  joiningDate: optionalDate,
});

async function findTeacher(schoolId: string, id: string) {
  const teacher = await db.teacher.findFirst({ where: { id, schoolId } });
  if (!teacher) throw new Error("Teacher not found");
  return teacher;
}

export async function createTeacher(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = teacherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { joiningDate, ...data } = parsed.data;

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  const teacher = await db.$transaction(async (tx) =>
    tx.teacher.create({
      data: {
        ...data,
        schoolId: school.id,
        photoId: upload.photo ? await createPhoto(tx, school.id, upload.photo) : null,
        employeeCode: await nextTeacherCode(tx, school.id),
        joiningDate: joiningDate ?? new Date(),
      },
    }),
  );

  revalidatePath("/admin", "layout");
  redirect(`/admin/teachers/${teacher.id}`);
}

export async function updateTeacher(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const school = await getCurrentSchool();
  const existing = await findTeacher(school.id, id);
  const parsed = teacherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { joiningDate, ...data } = parsed.data;

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  await db.$transaction(async (tx) => {
    const { photoId, staleId } = await resolvePhotoChange(
      tx,
      school.id,
      existing.photoId,
      upload.photo,
      formData.get("removePhoto") === "on",
    );
    await tx.teacher.update({
      where: { id },
      data: { ...data, joiningDate: joiningDate ?? existing.joiningDate, photoId },
    });
    if (staleId) await tx.photo.delete({ where: { id: staleId } });
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}

/**
 * "Remove" marks the teacher inactive and frees their class-teacher and
 * subject-teacher roles so those can be given to someone else.
 */
export async function removeTeacher(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findTeacher(school.id, id);
  await db.$transaction([
    db.section.updateMany({ where: { classTeacherId: id }, data: { classTeacherId: null } }),
    db.subjectTeacherAssignment.deleteMany({ where: { teacherId: id } }),
    db.teacher.update({ where: { id }, data: { status: "INACTIVE" } }),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Teacher removed." };
}

export async function restoreTeacher(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findTeacher(school.id, id);
  await db.teacher.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Teacher restored." };
}
