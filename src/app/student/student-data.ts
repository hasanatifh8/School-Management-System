import "server-only";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/student-auth";
import { studentExams } from "@/lib/student-profile";

/** The signed-in student with what their exams and results need. */
export async function loadPortalStudent() {
  const ctx = await requireStudent();
  const full = await db.student.findUniqueOrThrow({
    where: { id: ctx.student.id },
    include: { subjects: { select: { subjectId: true } }, enrollments: { select: { sectionId: true } } },
  });
  return { ...ctx, full };
}

/** The student's exams and tests that the school has shared (drafts are left out). */
export async function portalExams(student: Awaited<ReturnType<typeof loadPortalStudent>>["full"]) {
  return (await studentExams(student)).filter((e) => e.published);
}
