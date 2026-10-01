import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { noticeStatus } from "@/lib/notices-shared";

/**
 * A notice's attachment, from the link in its WhatsApp/SMS messages. No
 * sign-in: the token is unguessable. It stops working once the notice expires.
 */
export async function GET(_: Request, ctx: RouteContext<"/n/[token]">) {
  const { token } = await ctx.params;
  if (!/^[\w-]{8,32}$/.test(token)) return text("Not found", 404);
  const file = await db.noticeAttachment.findUnique({
    where: { token },
    include: { notice: { select: { publishAt: true, expiresOn: true, school: { select: { status: true } } } } },
  });
  if (!file || file.notice.school.status !== "ACTIVE") return text("Not found", 404);
  if (noticeStatus(file.notice, new Date(), todayISO()) === "EXPIRED") return text("This notice has expired, so its attachment is no longer available.", 410);
  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
