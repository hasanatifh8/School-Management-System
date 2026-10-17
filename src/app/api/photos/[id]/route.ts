import { db } from "@/lib/db";
import { getActor } from "@/lib/access";
import { getViewer } from "@/lib/school";
import { getSignedInStudent } from "@/lib/student-auth";
import { getSignedInTeacher } from "@/lib/teacher-auth";

export async function GET(_: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  // A signed-in student (and nobody else): only their own photo.
  if (!(await getViewer()) && !(await getSignedInTeacher())) {
    const student = await getSignedInStudent();
    if (student) {
      const own = student.photoId === id ? await db.photo.findUnique({ where: { id } }) : null;
      return own ? photoResponse(own) : new Response("Not found", { status: 404 });
    }
  }
  const actor = await getActor();
  const photo =
    actor.kind === "staff"
      ? await db.photo.findFirst({ where: { id, schoolId: actor.school.id } })
      : // Teachers: photos of students in their sections (any student if they collect fees), and their own.
        await db.photo.findFirst({
          where: {
            id,
            schoolId: actor.ctx.school.id,
            OR: [
              actor.ctx.teacher.canCollectFees ? { student: { isNot: null } } : { student: { sectionId: { in: [...actor.ctx.visibleSectionIds] }, status: "ACTIVE" } },
              { teacher: { id: actor.ctx.teacher.id } },
            ],
          },
        });
  if (!photo) return new Response("Not found", { status: 404 });
  return photoResponse(photo);
}

function photoResponse(photo: { data: Uint8Array; mimeType: string }) {
  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      // A new upload always gets a new id, so a given URL never changes.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
