"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextStudentCode } from "@/lib/codes";
import { getCurrentSchool } from "@/lib/school";
import { findSchoolSection, fullName } from "@/lib/queries";
import { createPhoto, readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import { getCurrentSession } from "@/lib/sessions";
import { findRollNumberClash, syncCurrentEnrollment } from "@/lib/enrollments";
import {
  type ActionState,
  optionalDate,
  optionalBloodGroup,
  optionalGender,
  optionalText,
  requiredText,
  validationError,
} from "@/lib/action-state";
import { normalizeDocumentNumber } from "@/lib/document-types";
import {
  MAX_STUDENT_AGE,
  MIN_STUDENT_AGE,
  RELIGIONS,
  dateOfBirthBounds,
  normalizeIndianMobile,
} from "@/lib/student-options";

const dobBounds = () => dateOfBirthBounds();

const studentSchema = z
  .object({
    firstName: requiredText("First name"),
    middleName: optionalText,
    lastName: requiredText("Last name"),
    gender: optionalGender,
    bloodGroup: optionalBloodGroup,
    dateOfBirth: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const { min, max } = dobBounds();
      const day = d.toISOString().slice(0, 10);
      if (day > new Date().toISOString().slice(0, 10)) {
        ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future" });
      } else if (day > max || day < min) {
        ctx.addIssue({
          code: "custom",
          message: `Student must be between ${MIN_STUDENT_AGE} and ${MAX_STUDENT_AGE} years old`,
        });
      }
    }),
    aadhaarNumber: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const result = normalizeDocumentNumber("AADHAAR", v ?? "");
        if ("error" in result) {
          ctx.addIssue({ code: "custom", message: result.error });
          return z.NEVER;
        }
        return result.value;
      }),
    category: z
      .enum(["GENERAL", "OBC", "SC_ST", "MINORITY", ""])
      .optional()
      .transform((v) => v || null),
    caste: optionalText,
    religion: z
      .enum([...RELIGIONS, ""])
      .optional()
      .transform((v) => v || null),
    nationality: optionalText,
    email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => v || null),
    phone: optionalText,
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
    lastSchoolName: optionalText,
    fatherName: optionalText,
    fatherPhone: optionalText,
    motherName: optionalText,
    motherPhone: optionalText,
    admissionDate: optionalDate,
    sectionId: optionalText,
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
    houseId: optionalText,
  })
  .transform(({ whatsappSameAsPhone, correspondenceSameAsPrimary, ...data }, ctx) => {
    // "Same as" checkboxes copy the other field.
    let whatsappNumber = data.whatsappNumber;
    if (whatsappSameAsPhone) {
      whatsappNumber = data.phone ? normalizeIndianMobile(data.phone) : null;
      if (data.phone && !whatsappNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Enter a valid 10-digit mobile number to use it for WhatsApp",
        });
        return z.NEVER;
      }
    }
    return {
      ...data,
      whatsappNumber,
      correspondenceAddress: correspondenceSameAsPrimary ? data.primaryAddress : data.correspondenceAddress,
    };
  });

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
  const admitted = admissionDate ?? new Date();
  const student = await db.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: {
        ...data,
        schoolId: school.id,
        photoId: upload.photo ? await createPhoto(tx, school.id, upload.photo) : null,
        studentCode: await nextStudentCode(tx, school.id, admitted),
        admissionDate: admitted,
        sectionId: section?.id ?? null,
        houseId,
        // New students get every subject of their class's curriculum.
        subjects: section
          ? { create: section.class.subjects.map((cs) => ({ subjectId: cs.subjectId })) }
          : undefined,
      },
    });
    await syncCurrentEnrollment(tx, session.id, created.id, created.sectionId, created.rollNumber);
    return created;
  });

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
