import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * School admin sessions. The cookie holds a random token; the database stores
 * only its SHA-256, so sessions can be listed and revoked (sign-out, password
 * reset, disabling an admin) without storing usable secrets.
 */
export const ADMIN_COOKIE = "admin_session";
const SESSION_HOURS = 12;

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startAdminSession(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.adminSession.create({ data: { id: tokenId(token), adminId, expiresAt } });
  await db.adminSession.deleteMany({ where: { adminId, expiresAt: { lt: new Date() } } }); // tidy up old ones
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endAdminSession() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { id: tokenId(token) } });
  jar.delete(ADMIN_COOKIE);
}

/** The signed-in school admin (with their school), or null. Once per request. */
export const getSignedInAdmin = cache(async () => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({
    where: { id: tokenId(token) },
    include: { admin: { include: { school: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { admin } = session;
  if (!admin.active || admin.school.status !== "ACTIVE") return null;
  return admin;
});

/** Signs an admin out everywhere (password reset, disabled, deleted). */
export function revokeAdminSessions(adminId: string) {
  return db.adminSession.deleteMany({ where: { adminId } });
}
