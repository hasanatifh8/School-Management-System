"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, requiredName, validationError } from "@/lib/action-state";
import { revokeAdminSessions } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/passwords";
import { getCurrentSchool } from "@/lib/school";

const password = z.string().superRefine((v, ctx) => {
  const problem = passwordProblem(v);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

const staffSchema = z.object({
  name: requiredName("Name").refine((v) => v.length >= 2, "Enter the full name"),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password,
});

/** A fees staff account of the current school (school admins manage only these). */
async function findStaff(id: string) {
  const school = await getCurrentSchool();
  return db.schoolAdmin.findFirst({ where: { id, schoolId: school.id, role: "ACCOUNTANT" } });
}

export async function createStaff(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { name, email } = parsed.data;
  if (await db.schoolAdmin.findUnique({ where: { email } })) {
    return { error: "This email is already used by another account.", fieldErrors: { email: ["Already used"] } };
  }
  await db.schoolAdmin.create({
    data: { schoolId: school.id, name, email, role: "ACCOUNTANT", passwordHash: await hashPassword(parsed.data.password) },
  });
  revalidatePath("/admin/staff");
  return { ok: true, message: `${name} can now sign in at /login with ${email}. They will only see Fees.` };
}

export async function resetStaffPassword(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await findStaff(id);
  if (!staff) return { error: "Account not found." };
  const parsed = password.safeParse(String(formData.get("newPassword") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.schoolAdmin.update({ where: { id }, data: { passwordHash: await hashPassword(parsed.data) } });
  await revokeAdminSessions(id);
  revalidatePath("/admin/staff");
  return { ok: true, message: "Password changed. They were signed out everywhere." };
}

export async function setStaffActive(id: string, active: boolean): Promise<ActionState> {
  const staff = await findStaff(id);
  if (!staff) return { error: "Account not found." };
  await db.schoolAdmin.update({ where: { id }, data: { active } });
  if (!active) await revokeAdminSessions(id);
  revalidatePath("/admin/staff");
  return { ok: true, message: active ? "Account turned on." : "Account turned off and signed out." };
}

export async function deleteStaff(id: string): Promise<ActionState> {
  const staff = await findStaff(id);
  if (!staff) return { error: "Account not found." };
  await db.schoolAdmin.delete({ where: { id } }); // sessions cascade; receipts keep the collector's name
  revalidatePath("/admin/staff");
  return { ok: true, message: `${staff.name}'s account was deleted.` };
}
