import "server-only";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { fullName } from "@/lib/queries";
import { getPortalSchool, getViewer } from "@/lib/school";
import { getSignedInTeacher } from "@/lib/teacher-auth";
import { getSignedInStudent } from "@/lib/student-auth";

/** Areas of the app, for filtering the school's activity log. */
export const ACTIVITY_CATEGORIES = [
  "Students",
  "Teachers",
  "Staff",
  "Classes",
  "Attendance",
  "Leave",
  "Fees",
  "Payroll",
  "Expenses",
  "Exams",
  "Notices",
  "Transport",
  "Timetable",
  "Calendar",
  "Documents",
  "Settings",
  "Sign-in",
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** Who is acting and for which school: an admin or cashier, Power Admin, or a teacher. */
async function currentActor() {
  const viewer = await getViewer();
  if (viewer?.kind === "admin") {
    return { school: viewer.admin.school, actor: `${viewer.admin.name} (${viewer.admin.role === "ADMIN" ? "admin" : "cashier"})` };
  }
  if (viewer?.kind === "power") return { school: await getPortalSchool(), actor: "Power Admin" };
  const teacher = await getSignedInTeacher();
  if (teacher) return { school: teacher.school, actor: `${fullName(teacher)} (teacher)` };
  const student = await getSignedInStudent();
  if (student) return { school: student.school, actor: `${fullName(student)} (student)` };
  return null;
}

/**
 * Records something done in a school for its activity log: who did it is the
 * signed-in admin, cashier, teacher or Power Admin. Never throws: a failed log
 * write mustn't undo or block the action itself.
 */
export async function logActivity(category: ActivityCategory, action: string, details?: string | null) {
  try {
    const who = await currentActor();
    if (!who) return;
    await db.auditLog.create({
      data: { category, action: action.slice(0, 200), details: details ? details.slice(0, 500) : null, actor: who.actor, schoolId: who.school.id, schoolName: who.school.name },
    });
  } catch (e) {
    console.error("Activity log write failed", e);
  }
}

/** Records activity for a given school and person, e.g. at sign-in, before anyone is signed in. */
export async function recordActivity(school: { id: string; name: string } | null, actor: string, category: ActivityCategory, action: string, details?: string | null) {
  try {
    await db.auditLog.create({ data: { category, action, details: details ?? null, actor, schoolId: school?.id ?? null, schoolName: school?.name ?? null } });
  } catch (e) {
    console.error("Activity log write failed", e);
  }
}

/** Logs a successful action's message (unless `action` is given) and returns its result unchanged. */
export async function logged<T extends ActionState>(category: ActivityCategory, state: T, action?: string, details?: string | null): Promise<T> {
  if (state.ok) await logActivity(category, action ?? state.message ?? "Saved", details);
  return state;
}
