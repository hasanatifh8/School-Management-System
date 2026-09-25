import { db } from "@/lib/db";
import { getActor } from "@/lib/access";

export async function GET(_: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const actor = await getActor();
  const photo =
    actor.kind === "staff"
      ? await db.photo.findFirst({ where: { id, schoolId: actor.school.id } })
      : // Teachers: photos of students in their sections, and their own.
        await db.photo.findFirst({
          where: {
            id,
            schoolId: actor.ctx.school.id,
            OR: [
              { student: { sectionId: { in: [...actor.ctx.visibleSectionIds] }, status: "ACTIVE" } },
              { teacher: { id: actor.ctx.teacher.id } },
            ],
          },
        });
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      // A new upload always gets a new id, so a given URL never changes.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
