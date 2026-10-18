import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { TEACHER_CLASS_COOKIE, requireTeacher } from "@/lib/teacher-auth";

/**
 * Switches which of their classes a class teacher works on ("My class" pages), then goes on to `to`.
 * Link prefetches (sent ahead of any click) must not switch: they would change the class
 * behind the teacher's back, to whichever link was prefetched last.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireTeacher();
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "/teacher/class";
  // Only ever back into the teacher portal.
  const target = new URL(to.startsWith("/teacher") && !to.startsWith("/teacher/switch-class") ? to : "/teacher/class", request.url);
  const prefetch =
    request.headers.has("next-router-prefetch") || request.headers.has("next-router-segment-prefetch") || request.headers.get("purpose") === "prefetch";
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  if (prefetch) return response;
  if (ctx.isClassTeacherOf(id)) {
    (await cookies()).set(TEACHER_CLASS_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/teacher", maxAge: 60 * 60 * 24 * 180 });
  }
  return response;
}
