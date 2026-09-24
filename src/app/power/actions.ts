"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, optionalText, validationError } from "@/lib/action-state";
import { db } from "@/lib/db";
import { loadDemoData } from "@/lib/demo-data";
import { readPhotoUpload } from "@/lib/photos";
import {
  checkPowerPassword,
  endPowerSession,
  powerAdminEnabled,
  requirePowerAdmin,
  startPowerSession,
} from "@/lib/power-auth";
import { audit, purgeRemoved, removeOrphanFiles, wipeSchoolData } from "@/lib/power-tools";
import { CURRENT_SCHOOL_COOKIE } from "@/lib/school";
import { revokeAdminSessions } from "@/lib/admin-auth";
import { hashPassword, passwordProblem } from "@/lib/passwords";

const LONG_TX = { timeout: 120_000, maxWait: 10_000 };

/* ───────────────────────── Session ───────────────────────── */

export async function powerLogin(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!powerAdminEnabled()) return { error: "Power Admin is turned off. Set POWER_ADMIN_PASSWORD first." };
  const ok = checkPowerPassword(String(formData.get("password") ?? ""));
  if (!ok) {
    await audit("Failed Power Admin login");
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: "Incorrect password." };
  }
  await startPowerSession();
  await audit("Power Admin login");
  redirect("/power");
}

export async function powerLogout() {
  await endPowerSession();
  redirect("/power/login");
}

/* ───────────────────────── Schools ───────────────────────── */

const schoolSchema = z.object({
  name: z.string().trim().min(2, "School name is required").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}$/, "2–12 letters or digits, e.g. DPS or SVM01"),
  board: optionalText,
  principalName: optionalText,
  establishedYear: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const year = Number(v);
      if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) {
        ctx.addIssue({ code: "custom", message: "Enter a year such as 1995" });
        return z.NEVER;
      }
      return year;
    }),
  motto: optionalText,
  address: optionalText,
  phone: optionalText,
  email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => v || null),
  website: z
    .union([z.literal(""), z.url({ message: "Enter a full address, e.g. https://school.edu.in" })])
    .optional()
    .transform((v) => v || null),
});

const adminSchema = z.object({
  adminName: z.string().trim().min(2, "Name is required").max(100),
  adminEmail: z.email("Enter a valid email").trim().toLowerCase(),
  adminPassword: z.string().superRefine((v, ctx) => {
    const problem = passwordProblem(v);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
});

async function emailTaken(email: string, exceptId?: string) {
  return Boolean(await db.schoolAdmin.findFirst({ where: { email, ...(exceptId && { id: { not: exceptId } }) } }));
}

async function findSchool(id: string) {
  const school = await db.school.findUnique({ where: { id } });
  if (!school) throw new Error("School not found");
  return school;
}

async function codeTaken(code: string, exceptId?: string) {
  return Boolean(await db.school.findFirst({ where: { code, ...(exceptId && { id: { not: exceptId } }) } }));
}

export async function createSchool(_: ActionState, formData: FormData): Promise<ActionState> {
  await requirePowerAdmin();
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (await codeTaken(parsed.data.code)) {
    return { error: "That school code is already used.", fieldErrors: { code: ["Already used by another school"] } };
  }
  const logo = await readPhotoUpload(formData, "logo");
  if ("error" in logo) return { error: logo.error, fieldErrors: { logo: [logo.error] } };
  const withDemo = formData.get("loadDemo") === "on";

  // Optional first school admin: all three fields, or none.
  const adminFields = ["adminName", "adminEmail", "adminPassword"].map((k) => String(formData.get(k) ?? "").trim());
  const wantsAdmin = adminFields.some(Boolean);
  const admin = wantsAdmin ? adminSchema.safeParse(Object.fromEntries(formData)) : null;
  if (admin && !admin.success) return validationError(admin.error);
  if (admin?.success && (await emailTaken(admin.data.adminEmail))) {
    return { error: "An admin with this email already exists.", fieldErrors: { adminEmail: ["Already used"] } };
  }
  const passwordHash = admin?.success ? await hashPassword(admin.data.adminPassword) : null;

  const school = await db.$transaction(async (tx) => {
    const created = await tx.school.create({
      data: { ...parsed.data, ...(logo.photo && { logo: { create: logo.photo } }) },
    });
    if (admin?.success && passwordHash) {
      await tx.schoolAdmin.create({
        data: { schoolId: created.id, name: admin.data.adminName, email: admin.data.adminEmail, passwordHash },
      });
    }
    if (withDemo) await loadDemoData(tx, created.id);
    return created;
  }, LONG_TX);

  await audit(
    "School created",
    school,
    [withDemo && "With demo data", admin?.success && `Admin: ${admin.data.adminEmail}`].filter(Boolean).join(" · ") || undefined,
  );
  revalidatePath("/", "layout");
  redirect(`/power/schools/${school.id}?created=1`);
}

export async function updateSchool(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePowerAdmin();
  const existing = await findSchool(id);
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (await codeTaken(parsed.data.code, id)) {
    return { error: "That school code is already used.", fieldErrors: { code: ["Already used by another school"] } };
  }
  const logo = await readPhotoUpload(formData, "logo");
  if ("error" in logo) return { error: logo.error, fieldErrors: { logo: [logo.error] } };

  await db.$transaction(async (tx) => {
    await tx.school.update({ where: { id }, data: parsed.data });
    if (logo.photo) {
      await tx.schoolLogo.upsert({ where: { schoolId: id }, create: { schoolId: id, ...logo.photo }, update: logo.photo });
    } else if (formData.get("removeLogo") === "on") {
      await tx.schoolLogo.deleteMany({ where: { schoolId: id } });
    }
  });
  await audit("School updated", { id, name: parsed.data.name }, existing.name !== parsed.data.name ? `Renamed from ${existing.name}` : undefined);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function setSchoolStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionState> {
  await requirePowerAdmin();
  const school = await findSchool(id);
  await db.school.update({ where: { id }, data: { status } });
  await audit(status === "ACTIVE" ? "School activated" : "School suspended", school);
  revalidatePath("/", "layout");
  return { ok: true, message: status === "ACTIVE" ? "School is active again." : "School suspended." };
}

/** Makes this school the one the Admin Portal works on, then opens it. */
export async function openSchoolAdmin(id: string) {
  await requirePowerAdmin();
  const school = await findSchool(id);
  if (school.status !== "ACTIVE") redirect(`/power/schools/${id}`);
  (await cookies()).set(CURRENT_SCHOOL_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  redirect("/admin");
}

/* ───────────────────────── Data tools ───────────────────────── */

export async function loadDemoIntoSchool(id: string): Promise<ActionState> {
  await requirePowerAdmin();
  const school = await findSchool(id);
  const used =
    (await db.schoolClass.count({ where: { schoolId: id } })) +
    (await db.subject.count({ where: { schoolId: id } })) +
    (await db.student.count({ where: { schoolId: id } })) +
    (await db.teacher.count({ where: { schoolId: id } }));
  if (used) return { error: "Demo data can only be loaded into an empty school. Reset its data first." };
  const result = await db.$transaction((tx) => loadDemoData(tx, id), LONG_TX);
  await audit("Demo data loaded", school, `${result.students} students, ${result.teachers} teachers`);
  revalidatePath("/", "layout");
  return { ok: true, message: `Loaded ${result.classes} classes, ${result.teachers} teachers and ${result.students} students.` };
}

function confirmCode(formData: FormData, code: string): ActionState | null {
  const typed = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (typed === code) return null;
  const message = `Type ${code} to confirm.`;
  return { error: message, fieldErrors: { confirm: [message] } };
}

export async function resetSchoolData(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePowerAdmin();
  const school = await findSchool(id);
  const problem = confirmCode(formData, school.code);
  if (problem) return problem;
  const counts = await db.$transaction((tx) => wipeSchoolData(tx, id), LONG_TX);
  const summary = `${counts.students} students, ${counts.teachers} teachers, ${counts.classes} classes, ${counts.documents} documents deleted`;
  await audit("School data reset", school, summary);
  revalidatePath("/", "layout");
  return { ok: true, message: `Reset complete: ${summary}.` };
}

export async function deleteSchool(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePowerAdmin();
  const school = await findSchool(id);
  const problem = confirmCode(formData, school.code);
  if (problem) return problem;
  const counts = await db.$transaction(async (tx) => {
    const wiped = await wipeSchoolData(tx, id);
    await tx.school.delete({ where: { id } });
    return wiped;
  }, LONG_TX);
  const jar = await cookies();
  if (jar.get(CURRENT_SCHOOL_COOKIE)?.value === id) jar.delete(CURRENT_SCHOOL_COOKIE);
  await audit("School deleted", school, `${counts.students} students, ${counts.teachers} teachers`);
  revalidatePath("/", "layout");
  redirect("/power?deleted=1");
}

export async function purgeRemovedPeople(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePowerAdmin();
  const school = await findSchool(id);
  const days = Number(formData.get("days") ?? 30);
  if (!Number.isInteger(days) || days < 0 || days > 3650) return { error: "Enter a number of days from 0." };
  const result = await db.$transaction((tx) => purgeRemoved(tx, id, days), LONG_TX);
  await audit("Removed records purged", school, `${result.students} students, ${result.teachers} teachers (removed ≥ ${days} days)`);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: result.students + result.teachers
      ? `Permanently deleted ${result.students} student(s) and ${result.teachers} teacher(s).`
      : "Nothing to purge.",
  };
}

export async function cleanOrphanFiles(): Promise<ActionState> {
  await requirePowerAdmin();
  const result = await db.$transaction((tx) => removeOrphanFiles(tx), LONG_TX);
  await audit("Unused files cleaned", null, `${result.files} document files, ${result.photos} photos`);
  revalidatePath("/power");
  return { ok: true, message: `Removed ${result.files} unused document file(s) and ${result.photos} unused photo(s).` };
}

/* ───────────────────────── School admins ───────────────────────── */

/** Creates a school admin who signs in at /login and sees only this school. */
export async function createSchoolAdmin(schoolId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePowerAdmin();
  const school = await findSchool(schoolId);
  const parsed = adminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { adminName, adminEmail, adminPassword } = parsed.data;
  if (await emailTaken(adminEmail)) {
    return { error: "An admin with this email already exists.", fieldErrors: { adminEmail: ["Already used"] } };
  }
  await db.schoolAdmin.create({
    data: { schoolId, name: adminName, email: adminEmail, passwordHash: await hashPassword(adminPassword) },
  });
  await audit("School admin added", school, adminEmail);
  revalidatePath(`/power/schools/${schoolId}`);
  return { ok: true, message: `${adminName} can now sign in at /login with ${adminEmail}. Share the password with them securely.` };
}

async function findAdmin(adminId: string) {
  const admin = await db.schoolAdmin.findUnique({ where: { id: adminId }, include: { school: true } });
  if (!admin) throw new Error("Admin not found");
  return admin;
}

export async function resetAdminPassword(adminId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePowerAdmin();
  const admin = await findAdmin(adminId);
  const password = String(formData.get("newPassword") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  await db.schoolAdmin.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(password) } });
  await revokeAdminSessions(adminId);
  await audit("School admin password reset", admin.school, admin.email);
  revalidatePath(`/power/schools/${admin.schoolId}`);
  return { ok: true, message: "Password reset. They were signed out everywhere." };
}

export async function setAdminActive(adminId: string, active: boolean): Promise<ActionState> {
  await requirePowerAdmin();
  const admin = await findAdmin(adminId);
  await db.schoolAdmin.update({ where: { id: adminId }, data: { active } });
  if (!active) await revokeAdminSessions(adminId);
  await audit(active ? "School admin enabled" : "School admin disabled", admin.school, admin.email);
  revalidatePath(`/power/schools/${admin.schoolId}`);
  return { ok: true, message: active ? "Account enabled." : "Account disabled and signed out." };
}

export async function deleteSchoolAdmin(adminId: string): Promise<ActionState> {
  await requirePowerAdmin();
  const admin = await findAdmin(adminId);
  await db.schoolAdmin.delete({ where: { id: adminId } }); // sessions cascade
  await audit("School admin deleted", admin.school, admin.email);
  revalidatePath(`/power/schools/${admin.schoolId}`);
  return { ok: true, message: "Admin deleted." };
}
