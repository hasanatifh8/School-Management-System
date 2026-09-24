import { buildExport } from "@/lib/export/build";
import type { ExportKind } from "@/lib/export/fields";
import { getCurrentSchool } from "@/lib/school";

/**
 * GET /api/export/students?fields=studentCode,fullName&classId=…
 * Excel file of the students/teachers matching the list filters.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/export/[kind]">) {
  const { kind } = await ctx.params;
  if (kind !== "students" && kind !== "teachers") return new Response("Not found", { status: 404 });

  const school = await getCurrentSchool();
  const { buffer } = await buildExport(kind as ExportKind, school.id, new URL(request.url).searchParams);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kind}-${date}.xlsx"`,
      // Personal data: don't keep copies in shared caches.
      "Cache-Control": "private, no-store",
    },
  });
}
