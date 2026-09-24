import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSignedInAdmin } from "@/lib/admin-auth";
import { hasPowerSession } from "@/lib/power-auth";

/** Cookie holding the school the Admin Portal is working on (set by Power Admin). */
export const CURRENT_SCHOOL_COOKIE = "current_school";

/**
 * The school the current request operates on, and the access check for the
 * whole Admin Portal. Every admin page, server action and file route calls it.
 *
 * - Power Admin signed in → the school chosen in Power Admin (or the oldest active one).
 * - School admin signed in → their own school, nothing else.
 * - Otherwise → redirected to /login.
 */
export const getCurrentSchool = cache(async () => {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.kind === "admin") return viewer.admin.school;

  const chosen = (await cookies()).get(CURRENT_SCHOOL_COOKIE)?.value;
  const school =
    (chosen && (await db.school.findFirst({ where: { id: chosen, status: "ACTIVE" } }))) ||
    (await db.school.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }));
  if (!school) redirect("/power?setup=1");
  return school;
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
