import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextStudentCode } from "@/lib/codes";
import { syncCurrentEnrollment } from "@/lib/enrollments";
import type { StudentInput } from "@/app/admin/students/schema";

type SectionWithCurriculum = { id: string; class: { subjects: { subjectId: string }[] } };

/**
 * Creates a student with a new student ID, the class curriculum as subjects and
 * a current-session enrollment. Used by the admission form and the bulk import.
 */
export async function createStudentRecord(
  tx: Prisma.TransactionClient,
  args: {
    schoolId: string;
    sessionId: string;
    // Any sectionId/houseId inside `data` is overridden by `section` and `houseId`.
    data: Omit<StudentInput, "sectionId" | "admissionDate" | "houseId"> &
      Partial<Pick<StudentInput, "sectionId" | "houseId">>;
    section: SectionWithCurriculum | null;
    houseId?: string | null;
    photoId?: string | null;
    admissionDate?: Date | null;
  },
) {
  const admitted = args.admissionDate ?? new Date();
  const created = await tx.student.create({
    data: {
      ...args.data,
      schoolId: args.schoolId,
      photoId: args.photoId ?? null,
      studentCode: await nextStudentCode(tx, args.schoolId, admitted),
      admissionDate: admitted,
      sectionId: args.section?.id ?? null,
      houseId: args.houseId ?? null,
      // New students get every subject of their class's curriculum.
      subjects: args.section
        ? { create: args.section.class.subjects.map((cs) => ({ subjectId: cs.subjectId })) }
        : undefined,
    },
  });
  await syncCurrentEnrollment(tx, args.sessionId, created.id, created.sectionId, created.rollNumber);
  return created;
}
