import { buildSchoolBackup } from "@/lib/export/build";
import { hasPowerSession } from "@/lib/power-auth";
import { audit } from "@/lib/power-tools";

/** GET /api/power/schools/:id/backup — full Excel backup of one school (Power Admin only). */
export async function GET(_: Request, ctx: RouteContext<"/api/power/schools/[id]/backup">) {
  if (!(await hasPowerSession())) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const { buffer, school } = await buildSchoolBackup(id).catch(() => ({ buffer: null, school: null }));
  if (!buffer || !school) return new Response("Not found", { status: 404 });

  await audit("Backup downloaded", school);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${school.code}-backup-${date}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
