import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { schoolLogoUrl } from "@/lib/school";

/** Remembers which school last signed in on this browser, to brand the sign-in page. */
export const LOGIN_SCHOOL_COOKIE = "login_school";

/**
 * The school whose name and logo the sign-in page shows, before anyone is
 * signed in: ?school=CODE, else the school last signed in on this browser,
 * else the only active school. Null when it can't tell (several schools).
 */
export async function getLoginSchool(code?: string | string[]) {
  const select = { id: true, name: true, logo: { select: { updatedAt: true } } } as const;
  const active = { status: "ACTIVE" as const };
  const school =
    (typeof code === "string" && code.trim() && (await db.school.findFirst({ where: { ...active, code: { equals: code.trim(), mode: "insensitive" } }, select }))) ||
    (await (async () => {
      const remembered = (await cookies()).get(LOGIN_SCHOOL_COOKIE)?.value;
      return remembered ? db.school.findFirst({ where: { ...active, id: remembered }, select }) : null;
    })()) ||
    (await (async () => {
      const only = await db.school.findMany({ where: active, select, take: 2 });
      return only.length === 1 ? only[0] : null;
    })());
  return school ? { name: school.name, logoUrl: schoolLogoUrl(school) } : null;
}

/** Called after a successful sign-in. */
export async function rememberLoginSchool(schoolId: string) {
  (await cookies()).set(LOGIN_SCHOOL_COOKIE, schoolId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}
