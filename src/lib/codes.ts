import type { Prisma } from "@/generated/prisma/client";

async function nextValue(tx: Prisma.TransactionClient, schoolId: string, key: string) {
  const counter = await tx.counter.upsert({
    where: { schoolId_key: { schoolId, key } },
    create: { schoolId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

/** Student ID such as STU-2026-0001. The sequence restarts each admission year. */
export async function nextStudentCode(
  tx: Prisma.TransactionClient,
  schoolId: string,
  admissionDate: Date,
) {
  const year = admissionDate.getFullYear();
  const n = await nextValue(tx, schoolId, `student:${year}`);
  return `STU-${year}-${String(n).padStart(4, "0")}`;
}

/** Teacher ID such as TCH-0001. */
export async function nextTeacherCode(tx: Prisma.TransactionClient, schoolId: string) {
  const n = await nextValue(tx, schoolId, "teacher");
  return `TCH-${String(n).padStart(4, "0")}`;
}
