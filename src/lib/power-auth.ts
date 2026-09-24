import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Power Admin access is a single password from the POWER_ADMIN_PASSWORD
 * environment variable. Without it (or if it's too short) the area is off.
 * The session is a signed, httpOnly cookie; changing the password invalidates
 * every session because the signing key is derived from it.
 */
const COOKIE = "power_session";
const SESSION_HOURS = 8;
export const MIN_PASSWORD_LENGTH = 10;

function configuredPassword() {
  const password = process.env.POWER_ADMIN_PASSWORD ?? "";
  return password.length >= MIN_PASSWORD_LENGTH ? password : null;
}

export function powerAdminEnabled() {
  return configuredPassword() !== null;
}

function signingKey(password: string) {
  return createHash("sha256").update(`power-admin-session:${password}`).digest();
}

function sign(payload: string, password: string) {
  return createHmac("sha256", signingKey(password)).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Compares against the configured password in constant time. */
export function checkPowerPassword(attempt: string) {
  const password = configuredPassword();
  if (!password) return false;
  const a = createHash("sha256").update(attempt).digest();
  const b = createHash("sha256").update(password).digest();
  return timingSafeEqual(a, b);
}

export async function startPowerSession() {
  const password = configuredPassword();
  if (!password) throw new Error("Power Admin is not configured.");
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  const payload = String(expires);
  (await cookies()).set(COOKIE, `${payload}.${sign(payload, password)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endPowerSession() {
  (await cookies()).delete(COOKIE);
}

export async function hasPowerSession() {
  const password = configuredPassword();
  if (!password) return false;
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, password))) return false;
  return Number(payload) > Date.now();
}

/**
 * Guard for every Power Admin page, server action and route handler.
 * Server actions are reachable by direct POST, so each one must call this.
 */
export async function requirePowerAdmin() {
  if (!(await hasPowerSession())) redirect("/power/login");
}
