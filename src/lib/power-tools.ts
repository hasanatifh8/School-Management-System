import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

/** Adds an entry to the Power Admin activity log. */
export function audit(action: string, school?: { id: string; name: string } | null, details?: string) {
  return db.auditLog.create({
    data: { action, schoolId: school?.id ?? null, schoolName: school?.name ?? null, details: details ?? null },
  });
}

/**
 * Deletes everything a school owns (students, teachers, classes, subjects,
 * houses, sessions, attendance, holidays, fees, staff, salaries, expenses, exams,
 * photos, documents, ID counters) but keeps the school,
 * its profile and logo. Order matters: document files and enrollments go
 * first because of their foreign keys.
 */
export async function wipeSchoolData(tx: Tx, schoolId: string) {
  const counts = {
    students: await tx.student.count({ where: { schoolId } }),
    teachers: await tx.teacher.count({ where: { schoolId } }),
    classes: await tx.schoolClass.count({ where: { schoolId } }),
    documents: await tx.document.count({ where: { schoolId } }),
  };
  await tx.documentFile.deleteMany({ where: { document: { schoolId } } }); // cascades to documents
  await tx.enrollment.deleteMany({ where: { session: { schoolId } } });
  await tx.attendanceDay.deleteMany({ where: { schoolId } }); // cascades to attendance records
  await tx.holiday.deleteMany({ where: { schoolId } });
  await tx.notice.deleteMany({ where: { schoolId } }); // cascades to recipients
  await tx.exam.deleteMany({ where: { schoolId } }); // cascades to sections and papers
  await tx.expense.deleteMany({ where: { schoolId } });
  await tx.expenseCategory.deleteMany({ where: { schoolId } });
  await tx.salaryPayment.deleteMany({ where: { schoolId } });
  await tx.staffMember.deleteMany({ where: { schoolId } });
  await tx.student.deleteMany({ where: { schoolId } });
  await tx.teacher.deleteMany({ where: { schoolId } });
  await tx.photo.deleteMany({ where: { schoolId } });
  await tx.schoolClass.deleteMany({ where: { schoolId } }); // cascades to sections and curricula
  await tx.subject.deleteMany({ where: { schoolId } });
  await tx.house.deleteMany({ where: { schoolId } });
  await tx.academicSession.deleteMany({ where: { schoolId } });
  await tx.counter.deleteMany({ where: { schoolId } });
  return counts;
}

export type PersonKind = "student" | "teacher" | "staff";

/**
 * Permanently deletes removed (INACTIVE) students, teachers or staff of a
 * school, with their photos and documents. `ids` null means all removed ones.
 * Active people are never touched. Fee receipts and salary payments keep the
 * copied name; attendance, marks, logins and enrollments go with the person.
 */
export async function deleteRemovedPeople(tx: Tx, schoolId: string, kind: PersonKind, ids: string[] | null, removedBefore?: Date) {
  const where = {
    schoolId,
    status: "INACTIVE" as const,
    ...(ids ? { id: { in: ids } } : {}),
    ...(removedBefore ? { updatedAt: { lte: removedBefore } } : {}),
  };
  const people =
    kind === "student"
      ? await tx.student.findMany({ where, select: { id: true, photoId: true } })
      : kind === "teacher"
        ? await tx.teacher.findMany({ where, select: { id: true, photoId: true } })
        : await tx.staffMember.findMany({ where, select: { id: true, photoId: true } });
  const found = people.map((p) => p.id);
  if (!found.length) return 0;

  const owner = { student: "studentId", teacher: "teacherId", staff: "staffMemberId" }[kind];
  await tx.documentFile.deleteMany({ where: { document: { [owner]: { in: found } } } }); // cascades to documents
  if (kind === "student") {
    await tx.enrollment.deleteMany({ where: { studentId: { in: found } } });
    await tx.student.deleteMany({ where: { id: { in: found } } });
  } else if (kind === "teacher") {
    await tx.teacher.deleteMany({ where: { id: { in: found } } });
  } else {
    await tx.staffMember.deleteMany({ where: { id: { in: found } } }); // cashier sign-in cascades
  }
  await tx.photo.deleteMany({ where: { id: { in: people.flatMap((p) => (p.photoId ? [p.photoId] : [])) } } });
  return found.length;
}

/** Permanently deletes removed students, teachers and staff whose last change is older than `days`. */
export async function purgeRemoved(tx: Tx, schoolId: string, days: number) {
  const before = new Date(Date.now() - days * 86_400_000);
  return {
    students: await deleteRemovedPeople(tx, schoolId, "student", null, before),
    teachers: await deleteRemovedPeople(tx, schoolId, "teacher", null, before),
    staff: await deleteRemovedPeople(tx, schoolId, "staff", null, before),
  };
}

/** Deletes stored files that nothing points to any more (across all schools). */
export async function removeOrphanFiles(tx: Tx) {
  const files = await tx.documentFile.deleteMany({ where: { document: null } });
  const photos = await tx.photo.deleteMany({ where: { student: null, teacher: null } });
  return { files: files.count, photos: photos.count };
}

/** Bytes used by each school's photos, documents and logo. */
export async function storageBySchool() {
  const rows = await db.$queryRaw<{ schoolId: string; bytes: bigint }[]>`
    SELECT "schoolId", SUM(bytes)::bigint AS bytes FROM (
      SELECT "schoolId", octet_length("data") AS bytes FROM "Photo"
      UNION ALL SELECT "schoolId", "size" FROM "Document"
      UNION ALL SELECT "schoolId", octet_length("data") FROM "SchoolLogo"
    ) t GROUP BY "schoolId"`;
  return new Map(rows.map((r) => [r.schoolId, Number(r.bytes)]));
}

/** Database size and migration state, for the system panel. */
export async function systemInfo() {
  const [[size], [migration], orphanFiles, orphanPhotos] = await Promise.all([
    db.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database())::bigint AS bytes`,
    db.$queryRaw<{ name: string; count: bigint }[]>`
      SELECT max(migration_name) AS name, count(*)::bigint AS count
      FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
    db.documentFile.count({ where: { document: null } }),
    db.photo.count({ where: { student: null, teacher: null } }),
  ]);
  return {
    databaseBytes: Number(size.bytes),
    migrations: Number(migration.count),
    latestMigration: migration.name,
    orphanFiles: orphanFiles + orphanPhotos,
  };
}
