"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { revokeAdminSessions } from "@/lib/admin-auth";
import { nextStaffCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { generatePassword, hashPassword } from "@/lib/passwords";
import { createPhoto, readPhotoUpload, resolvePhotoChange } from "@/lib/photos";
import { getCurrentSchool } from "@/lib/school";
import { staffSchema } from "./schema";

// Staff are school admins' business only; cashiers (fees-only accounts) can't reach these.

async function findStaff(schoolId: string, id: string) {
  const staff = await db.staffMember.findFirst({ where: { id, schoolId }, include: { cashierAccount: true } });
  if (!staff) throw new Error("Staff member not found");
  return staff;
}

const loginEmail = z.email("Enter a valid email").trim().toLowerCase();

/** Another account already signs in with this email (emails are unique across all schools). */
async function emailTaken(email: string, exceptAdminId?: string) {
  const other = await db.schoolAdmin.findUnique({ where: { email }, select: { id: true } });
  return !!other && other.id !== exceptAdminId;
}

const revalidate = () => revalidatePath("/admin", "layout");

export async function createStaffMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  const cashier = formData.get("makeCashier") === "on";
  if (cashier) {
    if (!data.email) return { error: "A cashier signs in with their email. Add one.", fieldErrors: { email: ["Needed to sign in as cashier"] } };
    if (await emailTaken(data.email)) return { error: "This email is already used by another account.", fieldErrors: { email: ["Already used to sign in"] } };
  }

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };
  const password = cashier ? generatePassword() : null;
  const passwordHash = password ? await hashPassword(password) : null;

  const staff = await db.$transaction(async (tx) => {
    const created = await tx.staffMember.create({
      data: {
        ...data,
        schoolId: school.id,
        employeeCode: await nextStaffCode(tx, school.id),
        photoId: upload.photo ? await createPhoto(tx, school.id, upload.photo) : null,
      },
    });
    if (passwordHash) {
      await tx.schoolAdmin.create({
        data: { schoolId: school.id, staffMemberId: created.id, name: created.name, email: data.email!, role: "ACCOUNTANT", passwordHash },
      });
    }
    return created;
  });

  revalidate();
  if (!password) redirect(`/admin/staff/${staff.id}`);
  // Show the new login once before moving on (the password is not stored in plain text).
  return {
    ok: true,
    message: `${staff.name} is now a cashier. Share these details with them now; the password won't be shown again.`,
    credentials: { username: data.email!, password },
    next: `/admin/staff/${staff.id}`,
  };
}

export async function updateStaffMember(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const existing = await findStaff(school.id, id);
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  // A cashier signs in with their email, so it has to stay valid and unique.
  const account = existing.cashierAccount;
  const emailChanged = !!account && data.email !== account.email;
  if (account && !data.email) return { error: "This person is a cashier and signs in with their email. Keep an email.", fieldErrors: { email: ["Needed to sign in as cashier"] } };
  if (emailChanged && (await emailTaken(data.email!, account.id))) {
    return { error: "This email is already used by another account.", fieldErrors: { email: ["Already used to sign in"] } };
  }

  const upload = await readPhotoUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { photo: [upload.error] } };

  await db.$transaction(async (tx) => {
    const { photoId, staleId } = await resolvePhotoChange(tx, school.id, existing.photoId, upload.photo, formData.get("removePhoto") === "on");
    await tx.staffMember.update({ where: { id }, data: { ...data, photoId } });
    if (staleId) await tx.photo.delete({ where: { id: staleId } });
    if (account) await tx.schoolAdmin.update({ where: { id: account.id }, data: { name: data.name, email: data.email! } });
  });
  if (emailChanged) await revokeAdminSessions(account.id);
  revalidate();
  return { ok: true, message: emailChanged ? "Saved. The cashier now signs in with the new email and was signed out." : "Saved." };
}

/** Takes someone off the payroll. Past salaries stay; a cashier's sign-in is turned off. */
export async function removeStaffMember(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const staff = await findStaff(school.id, id);
  await db.staffMember.update({ where: { id }, data: { status: "INACTIVE" } });
  if (staff.cashierAccount) {
    await db.schoolAdmin.update({ where: { id: staff.cashierAccount.id }, data: { active: false } });
    await revokeAdminSessions(staff.cashierAccount.id);
  }
  revalidate();
  return { ok: true, message: staff.cashierAccount ? "Removed. Their cashier sign-in was turned off." : "Removed from the payroll. Past salaries are kept." };
}

export async function restoreStaffMember(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findStaff(school.id, id);
  await db.staffMember.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidate();
  return { ok: true, message: "Back on the payroll." };
}

/* ───────────────────────── Cashier access ───────────────────────── */

/** Makes a staff member a cashier: a sign-in (their email + a generated password) that sees only Fees. */
export async function makeCashier(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const staff = await findStaff(school.id, id);
  if (staff.status !== "ACTIVE") return { error: "Restore this staff member first." };
  if (staff.cashierAccount) return { error: "Already a cashier." };
  const email = loginEmail.safeParse(formData.get("email") ?? "");
  if (!email.success) return { error: email.error.issues[0].message, fieldErrors: { email: [email.error.issues[0].message] } };
  if (await emailTaken(email.data)) return { error: "This email is already used by another account.", fieldErrors: { email: ["Already used to sign in"] } };

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.staffMember.update({ where: { id }, data: { email: email.data } }),
    db.schoolAdmin.create({ data: { schoolId: school.id, staffMemberId: id, name: staff.name, email: email.data, role: "ACCOUNTANT", passwordHash } }),
  ]);
  revalidate();
  return {
    ok: true,
    message: `${staff.name} is now a cashier. Share these details with them now; the password won't be shown again.`,
    credentials: { username: email.data, password },
  };
}

export async function resetCashierPassword(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const account = (await findStaff(school.id, id)).cashierAccount;
  if (!account) return { error: "Not a cashier." };
  const password = generatePassword();
  await db.schoolAdmin.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(password) } });
  await revokeAdminSessions(account.id);
  revalidate();
  return { ok: true, message: "New password created. They were signed out everywhere.", credentials: { username: account.email, password } };
}

export async function setCashierActive(id: string, active: boolean): Promise<ActionState> {
  const school = await getCurrentSchool();
  const staff = await findStaff(school.id, id);
  if (!staff.cashierAccount) return { error: "Not a cashier." };
  if (active && staff.status !== "ACTIVE") return { error: "Restore this staff member first." };
  await db.schoolAdmin.update({ where: { id: staff.cashierAccount.id }, data: { active } });
  if (!active) await revokeAdminSessions(staff.cashierAccount.id);
  revalidate();
  return { ok: true, message: active ? "Cashier sign-in turned on." : "Cashier sign-in turned off and signed out." };
}

/** Takes cashier access away. Receipts they issued keep their name. */
export async function removeCashier(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const staff = await findStaff(school.id, id);
  if (!staff.cashierAccount) return { error: "Not a cashier." };
  await db.schoolAdmin.delete({ where: { id: staff.cashierAccount.id } }); // sessions cascade
  revalidate();
  return { ok: true, message: `${staff.name} is no longer a cashier.` };
}
