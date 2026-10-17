import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { logged } from "@/lib/activity";
import { type ActionState, validationError } from "@/lib/action-state";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { readDocumentUpload } from "@/lib/documents";
import { MATERIAL_KINDS, KIND_META, type MaterialTarget } from "@/lib/materials-shared";
import { sectionLabel } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import type { TeacherContext } from "@/lib/teacher-auth";

/** Who is posting or managing study material: a school admin (anywhere) or a teacher (their sections). */
export type MaterialActor = { kind: "admin"; schoolId: string; who: string } | { kind: "teacher"; schoolId: string; who: string; ctx: TeacherContext };

/** Classes, sections and subjects the actor may post to. */
export async function materialTargets(actor: MaterialActor): Promise<MaterialTarget[]> {
  const classes = await db.schoolClass.findMany({
    where: { schoolId: actor.schoolId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { sections: { orderBy: { name: "asc" } }, subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } } },
  });
  const all = await db.subject.findMany({ where: { schoolId: actor.schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  if (actor.kind === "admin") {
    return classes.map((c) => {
      const subjects = c.subjects.length ? c.subjects.map((s) => ({ id: s.subject.id, name: s.subject.name })) : all;
      return { classId: c.id, className: c.name, wholeClass: true, sections: c.sections.map((s) => ({ id: s.id, name: s.name, subjects })), subjects };
    });
  }
  // Teachers: sections they are class teacher of (any of the class's subjects), and sections where they teach a subject (that subject).
  const { ctx } = actor;
  const assignments = await db.subjectTeacherAssignment.findMany({ where: { teacherId: ctx.teacher.id }, include: { subject: { select: { id: true, name: true } } } });
  const out: MaterialTarget[] = [];
  for (const c of classes) {
    const classSubjects = c.subjects.length ? c.subjects.map((s) => ({ id: s.subject.id, name: s.subject.name })) : all;
    const sections = c.sections
      .map((s) => {
        const subjects = ctx.isClassTeacherOf(s.id) ? classSubjects : assignments.filter((a) => a.sectionId === s.id).map((a) => a.subject);
        return { id: s.id, name: s.name, subjects };
      })
      .filter((s) => s.subjects.length);
    if (sections.length) out.push({ classId: c.id, className: c.name, wholeClass: false, sections, subjects: [...new Map(sections.flatMap((s) => s.subjects).map((x) => [x.id, x])).values()] });
  }
  return out;
}

const schema = z.object({
  title: z.string().trim().min(2, "Give it a title").max(120, "Keep the title under 120 characters"),
  description: z.string().trim().max(1000, "Keep it under 1000 characters").optional().transform((v) => v || null),
  kind: z.enum(MATERIAL_KINDS, "Choose what it is"),
  classId: z.string().min(1, "Choose the class"),
  sectionId: z.string().optional().transform((v) => v || null),
  subjectId: z.string().optional().transform((v) => v || null),
  dueDate: z
    .string()
    .optional()
    .refine((v) => !v || parseISODate(v), "Choose a real date")
    .transform((v) => (v ? parseISODate(v)! : null)),
  link: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/i.test(v), "Enter a full link starting with https://")
    .transform((v) => v || null),
});

/** Posts study material for a class or section: a file (PDF, image or Word) and/or a link. */
export async function createMaterialRecord(actor: MaterialActor, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  const targets = await materialTargets(actor);
  const target = targets.find((t) => t.classId === v.classId);
  if (!target) return { error: "You can't post to this class.", fieldErrors: { classId: ["Not allowed"] } };
  if (!v.sectionId && !target.wholeClass) return { error: "Choose the section.", fieldErrors: { sectionId: ["Choose the section"] } };
  const section = v.sectionId ? target.sections.find((s) => s.id === v.sectionId) : null;
  if (v.sectionId && !section) return { error: "You can't post to this section.", fieldErrors: { sectionId: ["Not allowed"] } };
  const allowedSubjects = section ? section.subjects : target.subjects;
  if (v.subjectId && !allowedSubjects.some((s) => s.id === v.subjectId)) return { error: "You can't post for this subject here.", fieldErrors: { subjectId: ["Not allowed"] } };
  if (actor.kind === "teacher" && !v.subjectId && section && !actor.ctx.isClassTeacherOf(section.id)) {
    return { error: "Choose the subject you teach.", fieldErrors: { subjectId: ["Choose the subject"] } };
  }

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !v.link) return { error: "Attach a file or add a link.", fieldErrors: { file: ["Attach a file or add a link"] } };
  const upload = hasFile ? await readDocumentUpload(formData, "file") : null;
  if (upload && "error" in upload) return { error: upload.error, fieldErrors: { file: [upload.error] } };

  const session = await getCurrentSession(actor.schoolId);
  const stored = upload && "file" in upload ? await db.materialFile.create({ data: { data: upload.file.data }, select: { id: true } }) : null;
  const created = await db.studyMaterial.create({
    data: {
      schoolId: actor.schoolId,
      sessionId: session.id,
      classId: v.classId,
      sectionId: v.sectionId,
      subjectId: v.subjectId,
      kind: v.kind,
      title: v.title,
      description: v.description,
      dueDate: v.kind === "ASSIGNMENT" ? v.dueDate : null,
      link: v.link,
      uploadedBy: actor.who,
      teacherId: actor.kind === "teacher" ? actor.ctx.teacher.id : null,
      ...(stored &&
        upload &&
        "file" in upload && { fileName: upload.file.fileName, mimeType: upload.file.mimeType, size: upload.file.size, fileId: stored.id }),
    },
    include: { class: true, section: { include: { class: true } }, subject: true },
  });
  const where = created.section ? sectionLabel(created.section) : created.class.name;
  return logged(
    "Classes",
    { ok: true, message: `${KIND_META[v.kind].label} posted to ${where}.` },
    `Posted ${KIND_META[v.kind].label.toLowerCase()} “${v.title}” to ${where}`,
    created.subject?.name ?? null,
  );
}

/** Deletes study material and its file: admins any, teachers only their own. */
export async function deleteMaterialRecord(actor: MaterialActor, id: string): Promise<ActionState> {
  const m = await db.studyMaterial.findFirst({ where: { id, schoolId: actor.schoolId, ...(actor.kind === "teacher" && { teacherId: actor.ctx.teacher.id }) } });
  if (!m) return { error: actor.kind === "teacher" ? "You can delete only what you posted." : "Not found." };
  await db.$transaction([db.studyMaterial.delete({ where: { id } }), ...(m.fileId ? [db.materialFile.delete({ where: { id: m.fileId } })] : [])]);
  return logged("Classes", { ok: true, message: "Deleted." }, `Deleted ${KIND_META[m.kind].label.toLowerCase()} “${m.title}”`);
}

const include = { class: true, section: { include: { class: true } }, subject: { select: { id: true, name: true } } } satisfies Prisma.StudyMaterialInclude;
export type MaterialRow = Prisma.StudyMaterialGetPayload<{ include: typeof include }>;

/** This session's material matching the filters, newest first. */
export async function listMaterials(where: Prisma.StudyMaterialWhereInput) {
  return db.studyMaterial.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}

/** What a student sees: their class's material, for the whole class or their section. */
export function studentMaterialWhere(schoolId: string, sessionId: string, section: { id: string; classId: string } | null): Prisma.StudyMaterialWhereInput {
  if (!section) return { id: "none" };
  return { schoolId, sessionId, classId: section.classId, OR: [{ sectionId: null }, { sectionId: section.id }] };
}

/** What a teacher sees: material for the sections they teach (and class-wide material for those classes). */
export function teacherMaterialWhere(ctx: TeacherContext, sessionId: string): Prisma.StudyMaterialWhereInput {
  const sectionIds = [...ctx.visibleSectionIds];
  return {
    schoolId: ctx.school.id,
    sessionId,
    OR: [{ sectionId: { in: sectionIds } }, { sectionId: null, class: { sections: { some: { id: { in: sectionIds } } } } }, { teacherId: ctx.teacher.id }],
  };
}
