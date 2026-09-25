import "server-only";
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt with N=2^15, r=8, p=1 (~32 MB, ~50–100 ms per check).
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const OPTIONS: ScryptOptions = { N, r: R, p: P, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** "scrypt$N$r$p$salt$hash" (base64url). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, OPTIONS);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Password rule shared by every form that sets one. Null when acceptable. */
export function passwordProblem(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  return null;
}

// No look-alike characters (0/O, 1/l/I) so a password can be read out or typed from paper.
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

/** 12-character password from a secure random source, always with letters and digits. */
export function generatePassword() {
  const pick = (set: string, n: number) => Array.from({ length: n }, () => set[randomInt(set.length)]).join("");
  const chars = (pick(LETTERS, 9) + pick(DIGITS, 3)).split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
