"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { nextTeacherCode } from "@/lib/codes";
import { getCurrentSchool } from "@/lib/school";
import { createPhoto, readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import { type ActionState, validationError } from "@/lib/action-state";
import { generatePassword, hashPassword } from "@/lib/passwords";
import { revokeTeacherSessions } from "@/lib/teacher-auth";
import { setClassTeacher, setSubjectTeacher } from "@/lib/teaching";
import type { Prisma } from "@/generated/prisma/client";
import { teacherSchema } from "./schema";

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;

/** A free username like "dps.tch0001" (adds -2, -3… if taken). */
async function suggestUsername(tx: Prisma.TransactionClient, schoolCode: string, employeeCode: string) {
  const base = `${schoolCode}.${employeeCode}`.toLowerCase().replace(/[^a-z0-9.]/g, "");
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await tx.teacher.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate;
  }
}

/** The ticked "Subjects they teach" that belong to this school. */
async function chosenSubjects(schoolId: string, formData: FormData) {
  const ids = formData.getAll("subjectIds").map(String);
  if (!ids.length) return [];
  return (await db.subject.findMany({ where: { schoolId, id: { in: ids } }, select: { id: true } })).map((s) => s.id);
}

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

  const subjectIds = await chosenSubjects(school.id, formData);
  const withLogin = formData.get("createLogin") === "on";
  const password = withLogin ? generatePassword() : null;
  const passwordHash = password ? await hashPassword(password) : null;

  const teacher = await db.$transaction(async (tx) => {
    const employeeCode = await nextTeacherCode(tx, school.id);
    return tx.teacher.create({
      data: {
        ...data,
        schoolId: school.id,
        photoId: upload.photo ? await createPhoto(tx, school.id, upload.photo) : null,
        employeeCode,
        joiningDate: joiningDate ?? new Date(),
        ...(passwordHash && { username: await suggestUsername(tx, school.code, employeeCode), passwordHash }),
        canTeach: { create: subjectIds.map((subjectId) => ({ subjectId })) },
      },
    });
  });

  revalidatePath("/admin", "layout");
  if (!password || !teacher.username) redirect(`/admin/teachers/${teacher.id}`);
  // Show the new login once before moving on (the password is not stored in plain text).
  return {
    ok: true,
    message: `${teacher.firstName}'s login is ready. Share it with them now; the password won't be shown again.`,
    credentials: { username: teacher.username, password },
    next: `/admin/teachers/${teacher.id}`,
  };
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
  const subjectIds = await chosenSubjects(school.id, formData);
  let unassigned = 0;

  await db.$transaction(async (tx) => {
    // Subjects they no longer teach: drop them, and their classes for those subjects.
    await tx.teacherSubject.deleteMany({ where: { teacherId: id, subjectId: { notIn: subjectIds } } });
    await tx.teacherSubject.createMany({ data: subjectIds.map((subjectId) => ({ teacherId: id, subjectId })), skipDuplicates: true });
    unassigned = (await tx.subjectTeacherAssignment.deleteMany({ where: { teacherId: id, subjectId: { notIn: subjectIds } } })).count;
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
  return {
    ok: true,
    message: unassigned ? `Saved. Removed from ${unassigned} class subject assignment(s) for subjects they no longer teach.` : "Saved.",
  };
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
    db.teacherSession.deleteMany({ where: { teacherId: id } }),
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

/* ───────────────────────── Teacher login ───────────────────────── */

/** Creates a login (generated username + password), or issues a new password. */
export async function issueTeacherLogin(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const teacher = await findTeacher(school.id, id);
  if (teacher.status !== "ACTIVE") return { error: "Restore this teacher before giving them a login." };
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const updated = await db.$transaction(async (tx) =>
    tx.teacher.update({
      where: { id },
      data: {
        passwordHash,
        loginEnabled: true,
        username: teacher.username ?? (await suggestUsername(tx, school.code, teacher.employeeCode)),
      },
    }),
  );
  await revokeTeacherSessions(id);
  revalidatePath(`/admin/teachers/${id}`);
  return {
    ok: true,
    message: teacher.passwordHash
      ? "New password created. The teacher was signed out everywhere."
      : "Login created. Share it with the teacher now; the password won't be shown again.",
    credentials: { username: updated.username!, password },
  };
}

export async function changeTeacherUsername(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const teacher = await findTeacher(school.id, id);
  if (!teacher.passwordHash) return { error: "Create a login first." };
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!USERNAME.test(username)) {
    const message = "3–40 characters: letters, digits, dots, dashes or underscores";
    return { error: message, fieldErrors: { username: [message] } };
  }
  if (username === teacher.username) return { ok: true, message: "Username unchanged." };
  const taken = await db.teacher.findUnique({ where: { username }, select: { id: true } });
  if (taken) return { error: "That username is already taken.", fieldErrors: { username: ["Already taken"] } };
  await db.teacher.update({ where: { id }, data: { username } });
  await revokeTeacherSessions(id);
  revalidatePath(`/admin/teachers/${id}`);
  return { ok: true, message: `Username changed to ${username}. The teacher was signed out.` };
}

export async function setTeacherLoginEnabled(id: string, enabled: boolean): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findTeacher(school.id, id);
  await db.teacher.update({ where: { id }, data: { loginEnabled: enabled } });
  if (!enabled) await revokeTeacherSessions(id);
  revalidatePath(`/admin/teachers/${id}`);
  return { ok: true, message: enabled ? "Login turned on." : "Login turned off and the teacher was signed out." };
}

export async function removeTeacherLogin(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findTeacher(school.id, id);
  await db.teacher.update({ where: { id }, data: { username: null, passwordHash: null, lastLoginAt: null } });
  await revokeTeacherSessions(id);
  revalidatePath(`/admin/teachers/${id}`);
  return { ok: true, message: "Login removed." };
}

/* ───────────────────────── Classes and subjects (from the teacher's profile) ───────────────────────── */

/** Makes the teacher class teacher of one more section (replacing that section's current one). */
export async function addClassTeacherSection(teacherId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const sectionId = String(formData.get("sectionId") ?? "");
  if (!sectionId) return { error: "Choose a class.", fieldErrors: { sectionId: ["Choose a class"] } };
  const result = await setClassTeacher(school.id, sectionId, teacherId);
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

/** Stops the teacher being class teacher of a section (if they still are). */
export async function removeClassTeacherSection(teacherId: string, sectionId: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const section = await db.section.findFirst({ where: { id: sectionId, classTeacherId: teacherId, class: { schoolId: school.id } } });
  if (!section) return { error: "They aren't class teacher of that section." };
  const result = await setClassTeacher(school.id, sectionId, null);
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

/** Gives the teacher a subject in a section (replacing whoever taught it there). */
export async function addSubjectAssignment(teacherId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const sectionId = String(formData.get("sectionId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  if (!sectionId || !subjectId) return { error: "Choose the class and the subject." };
  const result = await setSubjectTeacher(school.id, sectionId, subjectId, teacherId);
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

/** Takes a subject in a section off the teacher (if it is still theirs). */
export async function removeSubjectAssignment(teacherId: string, sectionId: string, subjectId: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const mine = await db.subjectTeacherAssignment.findFirst({ where: { sectionId, subjectId, teacherId, section: { class: { schoolId: school.id } } } });
  if (!mine) return { error: "That subject isn't theirs any more." };
  const result = await setSubjectTeacher(school.id, sectionId, subjectId, null);
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}
