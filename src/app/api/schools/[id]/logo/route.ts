import { db } from "@/lib/db";

/** GET /api/schools/:id/logo — the school's logo (URLs carry ?v=<updated time>). */
export async function GET(request: Request, ctx: RouteContext<"/api/schools/[id]/logo">) {
  const { id } = await ctx.params;
  const logo = await db.schoolLogo.findUnique({ where: { schoolId: id } });
  if (!logo) return new Response("Not found", { status: 404 });
  const versioned = new URL(request.url).searchParams.has("v");
  return new Response(Buffer.from(logo.data), {
    headers: {
      "Content-Type": logo.mimeType,
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
