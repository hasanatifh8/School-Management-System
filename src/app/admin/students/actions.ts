"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createStudentRecord } from "@/lib/students";
import { getCurrentSchool } from "@/lib/school";
import { findSchoolSection, fullName } from "@/lib/queries";
import { createPhoto, readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import { getCurrentSession } from "@/lib/sessions";
import { findRollNumberClash, syncCurrentEnrollment } from "@/lib/enrollments";
import { type ActionState, validationError } from "@/lib/action-state";
import { studentSchema } from "./schema";

/** Null when not chosen; undefined when the house doesn't belong to this school. */
async function resolveHouse(schoolId: string, houseId: string | null) {
  if (!houseId) return null;
  const house = await db.house.findFirst({ where: { id: houseId, schoolId }, select: { id: true } });
  return house?.id;
}

/** Error state when the roll number can't be used in that section, otherwise null. */
async function rollNumberProblem(
  sectionId: string | null,
  rollNumber: number | null,
  exceptStudentId?: string,
): Promise<ActionState | null> {
  if (rollNumber == null) return null;
  if (!sectionId) {
    const message = "Choose a class & section to give a roll number";
    return { error: message, fieldErrors: { rollNumber: [message] } };
  }
  const clash = await findRollNumberClash(db, sectionId, rollNumber, exceptStudentId);
  if (!clash) return null;
  const message = `Roll number ${rollNumber} is already used by ${fullName(clash)} in this section`;
  return { error: message, fieldErrors: { rollNumber: [message] } };
}

async function findStudent(schoolId: string, id: string) {
  const student = await db.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new Error("Student not found");
  return student;
}

export async function createStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { sectionId, admissionDate, houseId: houseInput, ...data } = parsed.data;

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  const section = sectionId ? await findSchoolSection(school.id, sectionId) : null;
  if (sectionId && !section) return { error: "Selected class/section no longer exists." };

  const houseId = await resolveHouse(school.id, houseInput);
  if (houseId === undefined) return { error: "Selected house no longer exists." };

  const rollProblem = await rollNumberProblem(section?.id ?? null, data.rollNumber);
  if (rollProblem) return rollProblem;

  const session = await getCurrentSession(school.id);
  const student = await db.$transaction(async (tx) =>
    createStudentRecord(tx, {
      schoolId: school.id,
      sessionId: session.id,
      data,
      section,
      houseId,
      photoId: upload.photo ? await createPhoto(tx, school.id, upload.photo) : null,
      admissionDate,
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
  const { sectionId, admissionDate, houseId: houseInput, ...data } = parsed.data;

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  const section = sectionId ? await findSchoolSection(school.id, sectionId) : null;
  if (sectionId && !section) return { error: "Selected class/section no longer exists." };

  const houseId = await resolveHouse(school.id, houseInput);
  if (houseId === undefined) return { error: "Selected house no longer exists." };

  const rollProblem = await rollNumberProblem(section?.id ?? null, data.rollNumber, id);
  if (rollProblem) return rollProblem;
  const session = await getCurrentSession(school.id);

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
        houseId,
        photoId,
      },
    });
    if (staleId) await tx.photo.delete({ where: { id: staleId } });
    await syncCurrentEnrollment(tx, session.id, id, section?.id ?? null, data.rollNumber);
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
