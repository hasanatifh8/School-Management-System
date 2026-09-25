import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts settings such as messaging API keys before they go in the database
 * (AES-256-GCM). The key comes from the SECRETS_KEY environment variable, so a
 * copy of the database alone doesn't reveal them. Changing SECRETS_KEY makes
 * saved keys unreadable; they then have to be entered again.
 */
function key() {
  const secret = process.env.SECRETS_KEY;
  if (!secret || secret.length < 16) return null;
  return createHash("sha256").update(secret).digest();
}

export const canEncrypt = () => key() !== null;

export function encrypt(plain: string) {
  const k = key();
  if (!k) throw new Error("SECRETS_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** The decrypted text, or null if it can't be read (no key, or a different key). */
export function decrypt(stored: string) {
  const k = key();
  const [v, iv, tag, data] = stored.split(".");
  if (!k || v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
