"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { endAdminSession, getSignedInAdmin, revokeAdminSessions, startAdminSession } from "@/lib/admin-auth";
import { endTeacherSession, getSignedInTeacher, revokeTeacherSessions, startTeacherSession } from "@/lib/teacher-auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/passwords";
import { audit } from "@/lib/power-tools";

// Verifying against this keeps the timing the same when the email doesn't exist.
const DUMMY_HASH = "scrypt$32768$8$1$c2FsdHNhbHRzYWx0c2FsdA$" + "A".repeat(86);

/** Sign-in for school admins (email) and teachers (username), chosen by the `role` field. */
export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const role = formData.get("role") === "teacher" ? "teacher" : "admin";
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (role === "teacher") {
    const teacher = identifier
      ? await db.teacher.findUnique({ where: { username: identifier }, include: { school: true } })
      : null;
    const ok = await verifyPassword(password, teacher?.passwordHash ?? DUMMY_HASH);
    if (!teacher || !ok) {
      await audit("Teacher sign-in failed", teacher?.school ?? null, identifier ? `Username: ${identifier}` : undefined);
      await new Promise((r) => setTimeout(r, 600)); // slow down guessing
      return { error: "Incorrect username or password." };
    }
    if (teacher.status !== "ACTIVE" || !teacher.loginEnabled) {
      return { error: "Your login is turned off. Contact your school admin." };
    }
    if (teacher.school.status !== "ACTIVE") return { error: `${teacher.school.name} is suspended. Contact your school.` };
    await startTeacherSession(teacher.id);
    await db.teacher.update({ where: { id: teacher.id }, data: { lastLoginAt: new Date() } });
    redirect("/teacher");
  }

  const admin = identifier
    ? await db.schoolAdmin.findUnique({ where: { email: identifier }, include: { school: true } })
    : null;
  const ok = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) {
    await audit("School admin sign-in failed", admin?.school ?? null, identifier ? `Email: ${identifier}` : undefined);
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: "Incorrect email or password." };
  }
  if (!admin.active) return { error: "This account is disabled. Contact your Power Admin." };
  if (admin.school.status !== "ACTIVE") return { error: `${admin.school.name} is suspended. Contact your Power Admin.` };

  await startAdminSession(admin.id);
  await db.schoolAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  redirect(admin.role === "ADMIN" ? "/admin" : "/admin/fees");
}

export async function adminLogout() {
  await endAdminSession();
  redirect("/login");
}

/** A signed-in school admin changes their own password; other sessions are signed out. */
export async function changeOwnPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getSignedInAdmin();
  if (!admin) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!(await verifyPassword(current, admin.passwordHash))) {
    return { error: "Current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password"] } };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem, fieldErrors: { newPassword: [problem] } };
  if (next !== confirm) return { error: "Passwords don't match.", fieldErrors: { confirmPassword: ["Doesn't match"] } };

  await db.schoolAdmin.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeAdminSessions(admin.id);
  await startAdminSession(admin.id); // keep this browser signed in
  return { ok: true, message: "Password changed. Other devices were signed out." };
}

export async function teacherLogout() {
  await endTeacherSession();
  redirect("/login?role=teacher");
}

/** A signed-in teacher changes their own password; other sessions are signed out. */
export async function changeTeacherPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const teacher = await getSignedInTeacher();
  if (!teacher?.passwordHash) redirect("/login?role=teacher");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!(await verifyPassword(current, teacher.passwordHash))) {
    return { error: "Current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password"] } };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem, fieldErrors: { newPassword: [problem] } };
  if (next !== confirm) return { error: "Passwords don't match.", fieldErrors: { confirmPassword: ["Doesn't match"] } };

  await db.teacher.update({ where: { id: teacher.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeTeacherSessions(teacher.id);
  await startTeacherSession(teacher.id);
  return { ok: true, message: "Password changed. Other devices were signed out." };
}
