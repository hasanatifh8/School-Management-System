import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/**
 * Student sessions (same scheme as teachers): the cookie holds a random token
 * and the database only its SHA-256, so sessions can be revoked.
 */
export const STUDENT_COOKIE = "student_session";
const SESSION_HOURS = 12;

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startStudentSession(studentId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.studentSession.create({ data: { id: tokenId(token), studentId, expiresAt } });
  await db.studentSession.deleteMany({ where: { studentId, expiresAt: { lt: new Date() } } });
  (await cookies()).set(STUDENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endStudentSession() {
  const jar = await cookies();
  const token = jar.get(STUDENT_COOKIE)?.value;
  if (token) await db.studentSession.deleteMany({ where: { id: tokenId(token) } });
  jar.delete(STUDENT_COOKIE);
}

export function revokeStudentSessions(studentId: string) {
  return db.studentSession.deleteMany({ where: { studentId } });
}

/** The signed-in student (active, login on, school active), with their class, or null. */
export const getSignedInStudent = cache(async () => {
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  const session = await db.studentSession.findUnique({
    where: { id: tokenId(token) },
    include: { student: { include: { school: true, section: { include: { class: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { student } = session;
  if (student.status !== "ACTIVE" || !student.loginEnabled || !student.passwordHash) return null;
  if (student.school.status !== "ACTIVE") return null;
  return student;
});

/** The signed-in student, or a redirect to sign in. Call it at the top of every student page, action and route. */
export const requireStudent = cache(async () => {
  const student = await getSignedInStudent();
  if (!student) redirect("/login?role=student");
  return { student, school: student.school, section: student.section };
});

export type StudentContext = Awaited<ReturnType<typeof requireStudent>>;
