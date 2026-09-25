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
 * houses, sessions, attendance, holidays, fees, staff, salaries, expenses,
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

/** Permanently deletes removed students/teachers whose last change is older than `days`. */
export async function purgeRemoved(tx: Tx, schoolId: string, days: number) {
  const before = new Date(Date.now() - days * 86_400_000);
  const where = { schoolId, status: "INACTIVE" as const, updatedAt: { lte: before } };
  const students = await tx.student.findMany({ where, select: { id: true, photoId: true } });
  const teachers = await tx.teacher.findMany({ where, select: { id: true, photoId: true } });
  const ids = [...students, ...teachers].map((p) => p.id);

  await tx.documentFile.deleteMany({
    where: { document: { OR: [{ studentId: { in: ids } }, { teacherId: { in: ids } }] } },
  });
  await tx.enrollment.deleteMany({ where: { studentId: { in: students.map((s) => s.id) } } });
  await tx.student.deleteMany({ where: { id: { in: students.map((s) => s.id) } } });
  await tx.teacher.deleteMany({ where: { id: { in: teachers.map((t) => t.id) } } });
  const photoIds = [...students, ...teachers].flatMap((p) => (p.photoId ? [p.photoId] : []));
  await tx.photo.deleteMany({ where: { id: { in: photoIds } } });
  return { students: students.length, teachers: teachers.length };
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
