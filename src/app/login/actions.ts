"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { endAdminSession, getSignedInAdmin, revokeAdminSessions, startAdminSession } from "@/lib/admin-auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/passwords";
import { audit } from "@/lib/power-tools";

// Verifying against this keeps the timing the same when the email doesn't exist.
const DUMMY_HASH = "scrypt$32768$8$1$c2FsdHNhbHRzYWx0c2FsdA$" + "A".repeat(86);

export async function adminLogin(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const admin = email
    ? await db.schoolAdmin.findUnique({ where: { email }, include: { school: true } })
    : null;
  const ok = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || !ok) {
    await audit("School admin sign-in failed", admin?.school ?? null, email ? `Email: ${email}` : undefined);
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: "Incorrect email or password." };
  }
  if (!admin.active) return { error: "This account is disabled. Contact your Power Admin." };
  if (admin.school.status !== "ACTIVE") return { error: `${admin.school.name} is suspended. Contact your Power Admin.` };

  await startAdminSession(admin.id);
  await db.schoolAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  redirect("/admin");
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
