import { getActor } from "@/lib/access";
import { db } from "@/lib/db";
import { canSeeLeave, teacherLeaveActor, type LeaveActor } from "@/lib/leave";
import { getViewer } from "@/lib/school";

/**
 * GET /api/leave/:id/attachment — the document sent with a leave request,
 * shown inline. Admins see any; teachers only requests they can see.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/leave/[id]/attachment">) {
  const { id } = await ctx.params;
  const actor = await getActor();
  let leaveActor: LeaveActor;
  if (actor.kind === "staff") {
    const viewer = await getViewer();
    leaveActor = { kind: "admin", schoolId: actor.school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" };
  } else leaveActor = teacherLeaveActor(actor.ctx);
  if (!(await canSeeLeave(leaveActor, id))) return new Response("Not found", { status: 404 });
  const file = await db.leaveAttachment.findUnique({ where: { leaveId: id } });
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
