import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";

export async function GET(_: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const school = await getCurrentSchool();
  const photo = await db.photo.findFirst({ where: { id, schoolId: school.id } });
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
