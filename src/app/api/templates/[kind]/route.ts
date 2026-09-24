import { db } from "@/lib/db";
import { buildTemplate } from "@/lib/import/excel";
import type { ImportKind } from "@/lib/import/columns";
import { getCurrentSchool } from "@/lib/school";

/** GET /api/templates/students or /api/templates/teachers: the bulk-upload Excel template. */
export async function GET(_: Request, ctx: RouteContext<"/api/templates/[kind]">) {
  const { kind } = await ctx.params;
  if (kind !== "students" && kind !== "teachers") return new Response("Not found", { status: 404 });

  const school = await getCurrentSchool();
  const classes = await db.schoolClass.findMany({
    where: { schoolId: school.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  const file = await buildTemplate(kind as ImportKind, classes.map((c) => c.name));

  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kind}-upload-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
