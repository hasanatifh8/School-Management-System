import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSignedInAdmin } from "@/lib/admin-auth";
import { hasPowerSession } from "@/lib/power-auth";
import { getSignedInTeacher } from "@/lib/teacher-auth";

/** Cookie holding the school the Admin Portal is working on (set by Power Admin). */
export const CURRENT_SCHOOL_COOKIE = "current_school";

/**
 * The school the signed-in admin, staff member or Power Admin is working on,
 * without checking their role. Use getCurrentSchool() (whole Admin Portal) or
 * getFeesAccess() (Fees) instead; this is for the shared layout.
 *
 * - Power Admin signed in → the school chosen in Power Admin (or the oldest active one).
 * - School admin / staff signed in → their own school, nothing else.
 * - A teacher allowed to collect fees (no admin sign-in) → their school; only Fees pages let them in.
 * - Otherwise → redirected to /login.
 */
export const getPortalSchool = cache(async () => {
  const viewer = await getViewer();
  if (!viewer) {
    const collector = await getFeeCollector();
    if (collector) return collector.school;
    redirect("/login");
  }
  if (viewer.kind === "admin") return viewer.admin.school;

  const chosen = (await cookies()).get(CURRENT_SCHOOL_COOKIE)?.value;
  const school =
    (chosen && (await db.school.findFirst({ where: { id: chosen, status: "ACTIVE" } }))) ||
    (await db.school.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }));
  if (!school) redirect("/power?setup=1");
  return school;
});

/**
 * The school the current request operates on, and the access check for the
 * whole Admin Portal. Every admin page, server action and file route calls it.
 * Only Power Admin and full school admins pass; fees staff (accountants) are
 * sent to the Fees section, the only part they may use.
 */
export const getCurrentSchool = cache(async () => {
  const school = await getPortalSchool();
  const viewer = await getViewer();
  // Fees staff, and teachers who collect fees, may only use the Fees pages.
  if (!viewer) redirect("/admin/fee-desk");
  if (viewer.kind === "admin" && viewer.admin.role !== "ADMIN") redirect("/admin/fees");
  return school;
});

/**
 * A signed-in teacher allowed to collect fees, when no admin or Power Admin is
 * signed in. They use the Fee desk and Fees pages as a cashier; everywhere else
 * they are still just a teacher (getViewer() stays null for them).
 */
export const getFeeCollector = cache(async () => {
  const teacher = await getSignedInTeacher();
  return teacher?.canCollectFees ? teacher : null;
});

/** Who is using the Admin Portal: Power Admin (takes precedence) or a school admin. */
export const getViewer = cache(async () => {
  if (await hasPowerSession()) return { kind: "power" as const };
  const admin = await getSignedInAdmin();
  return admin ? { kind: "admin" as const, admin } : null;
});

/** Active schools for the switcher, alphabetically. */
export function getActiveSchools() {
  return db.school.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, updatedAt: true, logo: { select: { updatedAt: true } } },
  });
}

/** URL of a school's logo, versioned so a new upload is never served from cache. */
export function schoolLogoUrl(school: { id: string; logo: { updatedAt: Date } | null }) {
  return school.logo ? `/api/schools/${school.id}/logo?v=${school.logo.updatedAt.getTime()}` : null;
}
