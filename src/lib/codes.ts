import type { Prisma } from "@/generated/prisma/client";

async function nextValue(tx: Prisma.TransactionClient, schoolId: string, key: string) {
  const counter = await tx.counter.upsert({
    where: { schoolId_key: { schoolId, key } },
    create: { schoolId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

/** Student ID digit counts a school can pick. */
export const STUDENT_ID_DIGITS = [3, 4, 5, 6] as const;

/** A student ID in the school's format, e.g. STU-2026-0001. */
export function formatStudentCode(prefix: string, year: number, n: number, digits: number) {
  return `${prefix}-${year}-${String(n).padStart(digits, "0")}`;
}

/**
 * Student ID such as STU-2026-0001: the school's prefix, the admission year and
 * a number. The sequence restarts each admission year.
 */
export async function nextStudentCode(
  tx: Prisma.TransactionClient,
  schoolId: string,
  admissionDate: Date,
) {
  const year = admissionDate.getFullYear();
  const school = await tx.school.findUniqueOrThrow({ where: { id: schoolId }, select: { studentIdPrefix: true, studentIdDigits: true } });
  const n = await nextValue(tx, schoolId, `student:${year}`);
  return formatStudentCode(school.studentIdPrefix, year, n, school.studentIdDigits);
}

/** Non-teaching staff ID such as STF-0001. */
export async function nextStaffCode(tx: Prisma.TransactionClient, schoolId: string) {
  const n = await nextValue(tx, schoolId, "staff");
  return `STF-${String(n).padStart(4, "0")}`;
}

/** Teacher ID such as TCH-0001. */
export async function nextTeacherCode(tx: Prisma.TransactionClient, schoolId: string) {
  const n = await nextValue(tx, schoolId, "teacher");
  return `TCH-${String(n).padStart(4, "0")}`;
}
