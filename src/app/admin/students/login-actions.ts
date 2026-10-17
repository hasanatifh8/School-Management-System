"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { logged } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { generatePassword, hashPassword } from "@/lib/passwords";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { revokeStudentSessions } from "@/lib/student-auth";

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;

/** A free username like "dps.stu-2026-0001" (adds -2, -3… if taken). */
async function suggestUsername(tx: Prisma.TransactionClient, schoolCode: string, studentCode: string) {
  const base = `${schoolCode}.${studentCode}`.toLowerCase().replace(/[^a-z0-9.-]/g, "");
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await tx.student.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate;
  }
}

async function findStudent(schoolId: string, id: string) {
  const student = await db.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new Error("Student not found");
  return student;
}

/** Creates a student's login (generated username + password), or issues a new password. */
export async function issueStudentLogin(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const student = await findStudent(school.id, id);
  if (student.status !== "ACTIVE") return { error: "Restore this student before giving them a login." };
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const updated = await db.$transaction(async (tx) =>
    tx.student.update({
      where: { id },
      data: { passwordHash, loginEnabled: true, username: student.username ?? (await suggestUsername(tx, school.code, student.studentCode)) },
    }),
  );
  await revokeStudentSessions(id);
  revalidatePath(`/admin/students/${id}`);
  return logged(
    "Students",
    {
      ok: true,
      message: student.passwordHash ? "New password created. The student was signed out everywhere." : "Login created. Share it with the student now; the password won't be shown again.",
      credentials: { username: updated.username!, password },
    },
    `${student.passwordHash ? "Reset the password of" : "Created a login for"} ${fullName(student)} (${student.studentCode})`,
  );
}

export async function changeStudentUsername(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const student = await findStudent(school.id, id);
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!USERNAME.test(username)) {
    const message = "3–40 characters: lowercase letters, numbers, dots, dashes or underscores.";
    return { error: message, fieldErrors: { username: [message] } };
  }
  if (username === student.username) return { ok: true, message: "Username unchanged." };
  if (await db.student.findUnique({ where: { username }, select: { id: true } })) return { error: "That username is already taken.", fieldErrors: { username: ["Already taken"] } };
  await db.student.update({ where: { id }, data: { username } });
  await revokeStudentSessions(id);
  revalidatePath(`/admin/students/${id}`);
  return logged("Students", { ok: true, message: `Username changed to ${username}. The student was signed out.` }, `Changed ${fullName(student)}'s username to ${username}`);
}

export async function setStudentLoginEnabled(id: string, enabled: boolean): Promise<ActionState> {
  const school = await getCurrentSchool();
  const student = await findStudent(school.id, id);
  await db.student.update({ where: { id }, data: { loginEnabled: enabled } });
  if (!enabled) await revokeStudentSessions(id);
  revalidatePath(`/admin/students/${id}`);
  return logged("Students", { ok: true, message: enabled ? "Login turned on." : "Login turned off and the student was signed out." }, `Turned ${enabled ? "on" : "off"} ${fullName(student)}'s login`);
}

export async function removeStudentLogin(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const student = await findStudent(school.id, id);
  await db.student.update({ where: { id }, data: { username: null, passwordHash: null, lastLoginAt: null } });
  await revokeStudentSessions(id);
  revalidatePath(`/admin/students/${id}`);
  return logged("Students", { ok: true, message: "Login removed." }, `Removed ${fullName(student)}'s login`);
}

export type BulkLoginState = ActionState & {
  section?: string;
  list?: { name: string; rollNumber: number | null; studentCode: string; username: string; password: string }[];
};

/**
 * Logins for every active student of a section who has none yet: a generated
 * username and password each, returned once as a list to print and hand out.
 */
export async function createSectionLogins(sectionId: string): Promise<BulkLoginState> {
  const school = await getCurrentSchool();
  const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId: school.id } }, include: { class: true } });
  if (!section) return { error: "Class not found." };
  const students = await db.student.findMany({
    where: { sectionId, status: "ACTIVE", passwordHash: null },
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
  });
  if (!students.length) return { ok: true, message: "Every student in this class already has a login.", list: [] };
  const list: NonNullable<BulkLoginState["list"]> = [];
  for (const s of students) {
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    const updated = await db.$transaction(async (tx) =>
      tx.student.update({ where: { id: s.id }, data: { passwordHash, loginEnabled: true, username: s.username ?? (await suggestUsername(tx, school.code, s.studentCode)) } }),
    );
    list.push({ name: fullName(s), rollNumber: s.rollNumber, studentCode: s.studentCode, username: updated.username!, password });
  }
  revalidatePath("/admin", "layout");
  return logged(
    "Students",
    { ok: true, message: `Created ${list.length} login${list.length === 1 ? "" : "s"}. Print or save this list now; the passwords won't be shown again.`, section: sectionLabel(section), list },
    `Created student logins for ${sectionLabel(section)}`,
    `${list.length} student${list.length === 1 ? "" : "s"}`,
  );
}
