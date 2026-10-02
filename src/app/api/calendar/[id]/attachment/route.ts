import { getActor } from "@/lib/access";
import { db } from "@/lib/db";

/**
 * A calendar entry's attachment. Admins can open any of their school's;
 * teachers only those of published entries. ?download saves instead of opening.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/calendar/[id]/attachment">) {
  const { id } = await ctx.params;
  const actor = await getActor();
  const schoolId = actor.kind === "staff" ? actor.school.id : actor.ctx.school.id;
  const file = await db.calendarAttachment.findFirst({
    where: { eventId: id, event: { schoolId, ...(actor.kind === "teacher" && { published: true }) } },
  });
  if (!file) return new Response("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
