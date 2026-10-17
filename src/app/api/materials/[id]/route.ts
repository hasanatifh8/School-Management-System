import { db } from "@/lib/db";
import { INLINE_TYPES } from "@/lib/documents";
import { getPortalSchool, getViewer } from "@/lib/school";
import { getSignedInStudent } from "@/lib/student-auth";
import { getSignedInTeacher, requireTeacher } from "@/lib/teacher-auth";

/**
 * GET /api/materials/:id: a study material's file. School admins see any of
 * their school's; teachers those of the sections they teach (and their own);
 * students only their own class's.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/materials/[id]">) {
  const { id } = await ctx.params;
  const m = await db.studyMaterial.findUnique({ where: { id }, include: { file: true, class: { select: { sections: { select: { id: true } } } } } });
  if (!m?.file || !(await canOpen(m))) return new Response("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const mimeType = m.mimeType ?? "application/octet-stream";
  const disposition = download || !INLINE_TYPES.has(mimeType) ? "attachment" : "inline";
  return new Response(Buffer.from(m.file.data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(m.file.data.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(m.fileName ?? "material")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function canOpen(m: { schoolId: string; classId: string; sectionId: string | null; teacherId: string | null; class: { sections: { id: string }[] } }) {
  if (await getViewer()) return (await getPortalSchool()).id === m.schoolId;
  if (await getSignedInTeacher()) {
    const t = await requireTeacher();
    if (t.school.id !== m.schoolId) return false;
    if (m.teacherId === t.teacher.id) return true;
    return m.sectionId ? t.visibleSectionIds.has(m.sectionId) : m.class.sections.some((s) => t.visibleSectionIds.has(s.id));
  }
  const student = await getSignedInStudent();
  return !!student && student.schoolId === m.schoolId && student.section?.classId === m.classId && (!m.sectionId || m.sectionId === student.sectionId);
}
