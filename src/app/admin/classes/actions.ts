"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { fullName, sectionLabel } from "@/lib/queries";
import { type ActionState, requiredText, validationError } from "@/lib/action-state";
import { autoAssignRollNumbers } from "@/lib/enrollments";
import { getCurrentSession } from "@/lib/sessions";

async function findClass(schoolId: string, id: string) {
  const schoolClass = await db.schoolClass.findFirst({ where: { id, schoolId } });
  if (!schoolClass) throw new Error("Class not found");
  return schoolClass;
}

async function findSection(schoolId: string, id: string) {
  const section = await db.section.findFirst({
    where: { id, class: { schoolId } },
    include: { class: true },
  });
  if (!section) throw new Error("Section not found");
  return section;
}

/** "A, B, C" → ["A", "B", "C"], uppercased and de-duplicated. */
function parseSectionNames(raw: string) {
  return [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
}

const classSchema = z.object({
  name: requiredText("Class name"),
  sections: z.string().optional().default(""),
});

export async function createClass(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { name } = parsed.data;
  const sections = parseSectionNames(parsed.data.sections);

  if (await db.schoolClass.findFirst({ where: { schoolId: school.id, name } })) {
    return { error: `${name} already exists.` };
  }

  const last = await db.schoolClass.findFirst({
    where: { schoolId: school.id },
    orderBy: { sortOrder: "desc" },
  });
  const created = await db.schoolClass.create({
    data: {
      schoolId: school.id,
      name,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      sections: { create: (sections.length ? sections : ["A"]).map((n) => ({ name: n })) },
    },
  });

  revalidatePath("/admin", "layout");
  redirect(`/admin/classes/${created.id}`);
}

export async function deleteClass(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findClass(school.id, id);
  const students = await db.student.count({ where: { section: { classId: id } } });
  if (students) {
    return { error: `Move the ${students} student(s) in this class to another class first.` };
  }
  if (await db.enrollment.count({ where: { section: { classId: id } } })) {
    return { error: "This class has records from past or upcoming sessions, so it can't be deleted." };
  }
  await db.schoolClass.delete({ where: { id } });
  revalidatePath("/admin", "layout");
  redirect("/admin/classes");
}

export async function addSection(classId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findClass(school.id, classId);
  const names = parseSectionNames(String(formData.get("name") ?? ""));
  if (!names.length) return { error: "Enter a section name." };

  const existing = await db.section.findMany({ where: { classId, name: { in: names } } });
  if (existing.length) {
    return { error: `Section ${existing.map((s) => s.name).join(", ")} already exists.` };
  }
  await db.section.createMany({ data: names.map((name) => ({ classId, name })) });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Added section ${names.join(", ")}.` };
}

export async function deleteSection(sectionId: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const section = await findSection(school.id, sectionId);
  const students = await db.student.count({ where: { sectionId } });
  if (students) {
    return { error: `Move the ${students} student(s) in ${sectionLabel(section)} to another section first.` };
  }
  if (await db.enrollment.count({ where: { sectionId } })) {
    return { error: `${sectionLabel(section)} has records from past or upcoming sessions, so it can't be deleted.` };
  }
  await db.section.delete({ where: { id: sectionId } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Section deleted." };
}

/**
 * Sets the class curriculum. Optionally syncs students already in the class:
 * newly added subjects are allotted to them, removed ones are taken away.
 */
export async function setClassSubjects(
  classId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findClass(school.id, classId);

  const requested = formData.getAll("subjectIds").map(String);
  const applyToStudents = formData.get("applyToStudents") === "on";

  const [subjects, current] = await Promise.all([
    db.subject.findMany({ where: { schoolId: school.id, id: { in: requested } }, select: { id: true } }),
    db.classSubject.findMany({ where: { classId } }),
  ]);
  const next = new Set(subjects.map((s) => s.id));
  const prev = new Set(current.map((c) => c.subjectId));
  const added = [...next].filter((id) => !prev.has(id));
  const removed = [...prev].filter((id) => !next.has(id));

  await db.$transaction(async (tx) => {
    await tx.classSubject.deleteMany({ where: { classId, subjectId: { in: removed } } });
    await tx.classSubject.createMany({ data: added.map((subjectId) => ({ classId, subjectId })) });
    // A subject no longer taught in this class can't have a subject teacher here.
    await tx.subjectTeacherAssignment.deleteMany({
      where: { subjectId: { in: removed }, section: { classId } },
    });

    if (applyToStudents) {
      const students = await tx.student.findMany({
        where: { section: { classId } },
        select: { id: true, subjects: { select: { subjectId: true } } },
      });
      await tx.studentSubject.deleteMany({
        where: { subjectId: { in: removed }, student: { section: { classId } } },
      });
      await tx.studentSubject.createMany({
        data: students.flatMap((s) => {
          const has = new Set(s.subjects.map((x) => x.subjectId));
          return added.filter((id) => !has.has(id)).map((subjectId) => ({ studentId: s.id, subjectId }));
        }),
      });
    }
  });

  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: `Curriculum saved (${added.length} added, ${removed.length} removed)${
      applyToStudents ? " and applied to students in this class" : ""
    }.`,
  };
}

export async function assignClassTeacher(
  sectionId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findSection(school.id, sectionId);
  const teacherId = String(formData.get("teacherId") ?? "") || null;

  if (teacherId) {
    const teacher = await db.teacher.findFirst({
      where: { id: teacherId, schoolId: school.id, status: "ACTIVE" },
      include: { classTeacherOf: { include: { class: true } } },
    });
    if (!teacher) return { error: "Teacher not found." };
    if (teacher.classTeacherOf && teacher.classTeacherOf.id !== sectionId) {
      return {
        error: `${fullName(teacher)} is already class teacher of ${sectionLabel(teacher.classTeacherOf)}. Unassign them there first.`,
      };
    }
  }

  await db.section.update({ where: { id: sectionId }, data: { classTeacherId: teacherId } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: teacherId ? "Class teacher assigned." : "Class teacher removed." };
}

export async function assignSubjectTeacher(
  sectionId: string,
  subjectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const school = await getCurrentSchool();
  const section = await findSection(school.id, sectionId);
  const teacherId = String(formData.get("teacherId") ?? "") || null;

  const taught = await db.classSubject.findUnique({
    where: { classId_subjectId: { classId: section.classId, subjectId } },
  });
  if (!taught) return { error: "This subject is not part of the class curriculum." };

  if (!teacherId) {
    await db.subjectTeacherAssignment.deleteMany({ where: { sectionId, subjectId } });
  } else {
    const teacher = await db.teacher.findFirst({
      where: { id: teacherId, schoolId: school.id, status: "ACTIVE" },
    });
    if (!teacher) return { error: "Teacher not found." };
    await db.subjectTeacherAssignment.upsert({
      where: { sectionId_subjectId: { sectionId, subjectId } },
      create: { sectionId, subjectId, teacherId },
      update: { teacherId },
    });
  }

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}

/** Numbers the section's active students A–Z from 1 ("all"), or only those without a number ("missing"). */
export async function assignRollNumbers(sectionId: string, mode: "all" | "missing"): Promise<ActionState> {
  const school = await getCurrentSchool();
  const section = await findSection(school.id, sectionId);
  const session = await getCurrentSession(school.id);
  const count = await db.$transaction((tx) => autoAssignRollNumbers(tx, session.id, sectionId, mode), {
    timeout: 30_000,
  });
  revalidatePath("/admin", "layout");
  if (!count) return { ok: true, message: "Everyone already has a roll number." };
  return {
    ok: true,
    message:
      mode === "all"
        ? `Numbered ${count} student(s) in ${sectionLabel(section)} from 1 (A–Z).`
        : `Gave roll numbers to ${count} student(s) without one.`,
  };
}
