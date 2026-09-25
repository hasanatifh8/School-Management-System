import { db } from "@/lib/db";
import { getActor } from "@/lib/access";
import { INLINE_TYPES } from "@/lib/documents";

export async function GET(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const actor = await getActor();
  // Teachers may only open documents of students in their own class.
  const document =
    actor.kind === "staff"
      ? await db.document.findFirst({ where: { id, schoolId: actor.school.id }, include: { file: true } })
      : actor.ctx.classSection
        ? await db.document.findFirst({
            where: { id, schoolId: actor.ctx.school.id, student: { sectionId: actor.ctx.classSection.id, status: "ACTIVE" } },
            include: { file: true },
          })
        : null;
  if (!document) return new Response("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const disposition = download || !INLINE_TYPES.has(document.mimeType) ? "attachment" : "inline";

  return new Response(Buffer.from(document.file.data), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      // Personal documents: never store in shared caches.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
