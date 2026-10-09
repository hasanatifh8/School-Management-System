import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/**
 * Teacher sessions (same scheme as school admins): the cookie holds a random
 * token and the database only its SHA-256, so sessions can be revoked.
 */
export const TEACHER_COOKIE = "teacher_session";
const SESSION_HOURS = 12;

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startTeacherSession(teacherId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.teacherSession.create({ data: { id: tokenId(token), teacherId, expiresAt } });
  await db.teacherSession.deleteMany({ where: { teacherId, expiresAt: { lt: new Date() } } });
  (await cookies()).set(TEACHER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endTeacherSession() {
  const jar = await cookies();
  const token = jar.get(TEACHER_COOKIE)?.value;
  if (token) await db.teacherSession.deleteMany({ where: { id: tokenId(token) } });
  jar.delete(TEACHER_COOKIE);
}

export function revokeTeacherSessions(teacherId: string) {
  return db.teacherSession.deleteMany({ where: { teacherId } });
}

/** The signed-in teacher (active, login enabled, school active), or null. */
export const getSignedInTeacher = cache(async () => {
  const token = (await cookies()).get(TEACHER_COOKIE)?.value;
  if (!token) return null;
  const session = await db.teacherSession.findUnique({
    where: { id: tokenId(token) },
    include: { teacher: { include: { school: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { teacher } = session;
  if (teacher.status !== "ACTIVE" || !teacher.loginEnabled || !teacher.passwordHash) return null;
  if (teacher.school.status !== "ACTIVE") return null;
  return teacher;
});

/** Cookie holding which of their classes a class teacher of several is working on. */
export const TEACHER_CLASS_COOKIE = "teacher_class";

/**
 * Everything a teacher may see: the sections they are class teacher of (full
 * access; `classSection` is the one chosen in the class switcher, the first by
 * default) and the sections where they teach a subject (list view). Redirects
 * to /login when nobody is signed in. Call it at the top of every teacher page, action and route.
 */
export const requireTeacher = cache(async () => {
  const teacher = await getSignedInTeacher();
  if (!teacher) redirect("/login");

  const [classSections, assignments, chosen] = await Promise.all([
    db.section.findMany({ where: { classTeacherId: teacher.id }, include: { class: true }, orderBy: [{ class: { sortOrder: "asc" } }, { name: "asc" }] }),
    db.subjectTeacherAssignment.findMany({
      where: { teacherId: teacher.id },
      include: { subject: true, section: { include: { class: true } } },
      orderBy: [{ section: { class: { sortOrder: "asc" } } }, { section: { name: "asc" } }],
    }),
    cookies().then((jar) => jar.get(TEACHER_CLASS_COOKIE)?.value),
  ]);
  // "My class" pages work on this one; the switcher changes it.
  const classSection = classSections.find((s) => s.id === chosen) ?? classSections[0] ?? null;

  // Group subject assignments by section.
  const subjectSections = new Map<string, { section: (typeof assignments)[number]["section"]; subjects: string[] }>();
  for (const a of assignments) {
    const entry = subjectSections.get(a.sectionId) ?? { section: a.section, subjects: [] };
    entry.subjects.push(a.subject.name);
    subjectSections.set(a.sectionId, entry);
  }

  return {
    teacher,
    school: teacher.school,
    classSection,
    /** Every section they are class teacher of. */
    classSections,
    /** Whether they are class teacher of this section. */
    isClassTeacherOf: (sectionId: string | null | undefined) => !!sectionId && classSections.some((s) => s.id === sectionId),
    subjectSections: [...subjectSections.values()],
    /** Sections whose student list the teacher may see. */
    visibleSectionIds: new Set([...classSections.map((s) => s.id), ...subjectSections.keys()]),
  };
});

export type TeacherContext = Awaited<ReturnType<typeof requireTeacher>>;

/** A student in one of the teacher's own (class-teacher) sections, or null. */
export function findClassStudent(ctx: TeacherContext, studentId: string) {
  if (!ctx.classSections.length) return null;
  return db.student.findFirst({
    where: { id: studentId, schoolId: ctx.school.id, sectionId: { in: ctx.classSections.map((s) => s.id) }, status: "ACTIVE" },
  });
}
