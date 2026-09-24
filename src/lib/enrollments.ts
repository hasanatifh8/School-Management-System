import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Keeps the current session's enrollment in step with Student.sectionId and
 * Student.rollNumber (the student's class "now"). Call after changing either.
 */
export async function syncCurrentEnrollment(
  tx: Tx,
  sessionId: string,
  studentId: string,
  sectionId: string | null,
  rollNumber: number | null,
) {
  if (!sectionId) {
    await tx.enrollment.deleteMany({ where: { sessionId, studentId } });
    return;
  }
  await tx.enrollment.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    create: { sessionId, studentId, sectionId, rollNumber },
    update: { sectionId, rollNumber },
  });
}

/** Another active student in the section who already has this roll number, if any. */
export function findRollNumberClash(tx: Tx, sectionId: string, rollNumber: number, exceptStudentId?: string) {
  return tx.student.findFirst({
    where: {
      sectionId,
      rollNumber,
      status: "ACTIVE",
      ...(exceptStudentId && { id: { not: exceptStudentId } }),
    },
    select: { firstName: true, middleName: true, lastName: true },
  });
}

/**
 * Numbers the active students of a section alphabetically from 1.
 * `missing` keeps existing numbers and continues after the highest one.
 * Returns how many students were numbered.
 */
export async function autoAssignRollNumbers(
  tx: Tx,
  sessionId: string,
  sectionId: string,
  mode: "all" | "missing",
) {
  const students = await tx.student.findMany({
    where: { sectionId, status: "ACTIVE" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { studentCode: "asc" }],
    select: { id: true, rollNumber: true },
  });
  const targets = mode === "all" ? students : students.filter((s) => s.rollNumber == null);
  let next = mode === "all" ? 1 : Math.max(0, ...students.map((s) => s.rollNumber ?? 0)) + 1;

  for (const s of targets) {
    const rollNumber = next++;
    await tx.student.update({ where: { id: s.id }, data: { rollNumber } });
    await tx.enrollment.updateMany({ where: { sessionId, studentId: s.id }, data: { rollNumber } });
  }
  return targets.length;
}
