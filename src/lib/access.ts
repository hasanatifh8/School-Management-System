import "server-only";
import { redirect } from "next/navigation";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { getSignedInTeacher, requireTeacher, type TeacherContext } from "@/lib/teacher-auth";

export type Actor = { kind: "staff"; school: Awaited<ReturnType<typeof getCurrentSchool>> } | { kind: "teacher"; ctx: TeacherContext };

/**
 * Who is making a request that both admins and teachers can make (photos,
 * documents): a school admin / Power Admin (whole school) or a teacher
 * (limited to their sections). Anyone else is sent to /login.
 */
export async function getActor(): Promise<Actor> {
  if (await getViewer()) return { kind: "staff", school: await getCurrentSchool() };
  if (await getSignedInTeacher()) return { kind: "teacher", ctx: await requireTeacher() };
  redirect("/login");
}
