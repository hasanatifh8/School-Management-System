"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextStudentCode } from "@/lib/codes";
import { getCurrentSchool } from "@/lib/school";
import { findSchoolSection } from "@/lib/queries";
import { createPhoto, readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import {
  type ActionState,
  optionalDate,
  optionalGender,
  optionalText,
  requiredText,
  validationError,
} from "@/lib/action-state";

const studentSchema = z.object({
  firstName: requiredText("First name"),
  lastName: requiredText("Last name"),
  gender: optionalGender,
  dateOfBirth: optionalDate,
  email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => v || null),
  phone: optionalText,
  address: optionalText,
  fatherName: optionalText,
  fatherPhone: optionalText,
  motherName: optionalText,
  motherPhone: optionalText,
  admissionDate: optionalDate,
  sectionId: optionalText,
});

async function findStudent(schoolId: string, id: string) {
  const student = await db.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new Error("Student not found");
  return student;
}

export async function createStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { sectionId, admissionDate, ...data } = parsed.data;

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  const section = sectionId ? await findSchoolSection(school.id, sectionId) : null;
  if (sectionId && !section) return { error: "Selected class/section no longer exists." };

  const admitted = admissionDate ?? new Date();
  const student = await db.$transaction(async (tx) =>
    tx.student.create({
      data: {
        ...data,
        schoolId: school.id,
        photoId: upload.photo ? await createPhoto(tx, school.id, upload.photo) : null,
        studentCode: await nextStudentCode(tx, school.id, admitted),
        admissionDate: admitted,
        sectionId: section?.id ?? null,
        // New students get every subject of their class's curriculum.
        subjects: section
          ? { create: section.class.subjects.map((cs) => ({ subjectId: cs.subjectId })) }
          : undefined,
      },
    }),
  );

  revalidatePath("/admin", "layout");
  redirect(`/admin/students/${student.id}`);
}

export async function updateStudent(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const school = await getCurrentSchool();
  const existing = await db.student.findFirst({
    where: { id, schoolId: school.id },
    include: { section: true },
  });
  if (!existing) return { error: "Student not found." };

  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { sectionId, admissionDate, ...data } = parsed.data;

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  const section = sectionId ? await findSchoolSection(school.id, sectionId) : null;
  if (sectionId && !section) return { error: "Selected class/section no longer exists." };

  // Moving to a different class replaces the subjects with that class's curriculum.
  // Moving between sections of the same class keeps the current allotment.
  const classChanged = (existing.section?.classId ?? null) !== (section?.classId ?? null);

  await db.$transaction(async (tx) => {
    const { photoId, staleId } = await resolvePhotoChange(
      tx,
      school.id,
      existing.photoId,
      upload.photo,
      formData.get("removePhoto") === "on",
    );
    await tx.student.update({
      where: { id },
      data: {
        ...data,
        admissionDate: admissionDate ?? existing.admissionDate,
        sectionId: section?.id ?? null,
        photoId,
      },
    });
    if (staleId) await tx.photo.delete({ where: { id: staleId } });
    if (classChanged) {
      await tx.studentSubject.deleteMany({ where: { studentId: id } });
      if (section) {
        await tx.studentSubject.createMany({
          data: section.class.subjects.map((cs) => ({ studentId: id, subjectId: cs.subjectId })),
        });
      }
    }
  });

  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: classChanged
      ? "Saved. Subjects were reset to the new class's curriculum."
      : "Saved.",
  };
}

export async function setStudentSubjects(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findStudent(school.id, id);

  const requested = formData.getAll("subjectIds").map(String);
  const subjects = await db.subject.findMany({
    where: { schoolId: school.id, id: { in: requested } },
    select: { id: true },
  });

  await db.$transaction([
    db.studentSubject.deleteMany({ where: { studentId: id } }),
    db.studentSubject.createMany({
      data: subjects.map((s) => ({ studentId: id, subjectId: s.id })),
    }),
  ]);

  revalidatePath("/admin", "layout");
  return { ok: true, message: `${subjects.length} subject(s) allotted.` };
}

/** "Remove" keeps the record (for history) but marks the student inactive. */
export async function removeStudent(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findStudent(school.id, id);
  await db.student.update({ where: { id }, data: { status: "INACTIVE" } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Student removed." };
}

export async function restoreStudent(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findStudent(school.id, id);
  await db.student.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Student restored." };
}
