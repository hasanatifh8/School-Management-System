import "server-only";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";

// Who teaches what: class teachers and subject teachers, set from a class's
// page, the Assign teachers grid or a teacher's profile. One set of rules.

async function activeTeacher(schoolId: string, teacherId: string) {
  return db.teacher.findFirst({ where: { id: teacherId, schoolId, status: "ACTIVE" }, select: { id: true, firstName: true, middleName: true, lastName: true } });
}

async function schoolSection(schoolId: string, sectionId: string) {
  return db.section.findFirst({ where: { id: sectionId, class: { schoolId } }, include: { class: true } });
}

/** Makes a teacher class teacher of a section (a teacher can have several), or (null) leaves it without one. */
export async function setClassTeacher(schoolId: string, sectionId: string, teacherId: string | null): Promise<ActionState> {
  const section = await schoolSection(schoolId, sectionId);
  if (!section) return { error: "Section not found." };
  const teacher = teacherId ? await activeTeacher(schoolId, teacherId) : null;
  if (teacherId && !teacher) return { error: "Teacher not found." };
  await db.section.update({ where: { id: sectionId }, data: { classTeacherId: teacher?.id ?? null } });
  return { ok: true, message: teacher ? `${fullName(teacher)} is class teacher of ${sectionLabel(section)}.` : `${sectionLabel(section)} has no class teacher now.` };
}

/**
 * Sets who teaches a subject in a section, or (null) leaves it unassigned. The
 * subject must be in the class's curriculum; a teacher not yet down as teaching
 * it gets it added to "Subjects they teach".
 */
export async function setSubjectTeacher(schoolId: string, sectionId: string, subjectId: string, teacherId: string | null): Promise<ActionState> {
  const section = await schoolSection(schoolId, sectionId);
  if (!section) return { error: "Section not found." };
  const taught = await db.classSubject.findUnique({ where: { classId_subjectId: { classId: section.classId, subjectId } }, include: { subject: true } });
  if (!taught) return { error: "This subject is not part of the class curriculum." };
  if (!teacherId) {
    await db.subjectTeacherAssignment.deleteMany({ where: { sectionId, subjectId } });
    return { ok: true, message: `${taught.subject.name} in ${sectionLabel(section)} is unassigned.` };
  }
  const teacher = await activeTeacher(schoolId, teacherId);
  if (!teacher) return { error: "Teacher not found." };
  const qualified = await db.teacherSubject.findUnique({ where: { teacherId_subjectId: { teacherId, subjectId } } });
  await db.$transaction([
    ...(qualified ? [] : [db.teacherSubject.create({ data: { teacherId, subjectId } })]),
    db.subjectTeacherAssignment.upsert({
      where: { sectionId_subjectId: { sectionId, subjectId } },
      create: { sectionId, subjectId, teacherId },
      update: { teacherId },
    }),
  ]);
  return {
    ok: true,
    message: `${fullName(teacher)} teaches ${taught.subject.name} in ${sectionLabel(section)}.${qualified ? "" : ` ${taught.subject.name} was added to their subjects.`}`,
  };
}
