import { timingSafeEqual } from "node:crypto";
import { sendDueNotices } from "@/lib/messaging/server";

/**
 * Daily job (vercel.json, 7 AM India time): sends notices scheduled for today,
 * and any left unfinished. Vercel calls it with "Authorization: Bearer
 * <CRON_SECRET>"; without CRON_SECRET set it stays switched off.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const notices = await sendDueNotices(50);
  return Response.json({ ok: true, notices });
}

export const maxDuration = 60;
