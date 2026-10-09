import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { TEACHER_CLASS_COOKIE, requireTeacher } from "@/lib/teacher-auth";

/** Switches which of their classes a class teacher works on ("My class" pages), then goes on to `to`. */
export async function GET(request: NextRequest) {
  const ctx = await requireTeacher();
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "/teacher/class";
  if (ctx.isClassTeacherOf(id)) {
    (await cookies()).set(TEACHER_CLASS_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/teacher", maxAge: 60 * 60 * 24 * 180 });
  }
  // Only ever back into the teacher portal.
  return NextResponse.redirect(new URL(to.startsWith("/teacher") ? to : "/teacher/class", request.url));
}
