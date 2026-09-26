import "server-only";
// Exams (admin) and class tests (teachers): validation, permissions and loading,
// shared by both portals' server actions and pages.
import { z } from "zod";
import type { ExamKind } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { type ActionState, validationError } from "@/lib/action-state";
import { isoDate, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import {
  MAX_PAPERS,
  TIME,
  paperName,
  readPrintSettings,
  timeRange,
  type PaperInput,
  type PaperView,
} from "@/lib/exams-shared";
import { sectionLabel } from "@/lib/queries";
import type { TeacherContext } from "@/lib/teacher-auth";

/**
 * Who is working on exams. Admins may use every section and subject; a teacher
 * only the sections they teach, and only subjects they may set papers in.
 */
export type ExamActor =
  | { kind: "admin"; schoolId: string; who: string }
  | { kind: "teacher"; schoolId: string; who: string; ctx: TeacherContext };

export function teacherActor(ctx: TeacherContext): ExamActor {
  return { kind: "teacher", schoolId: ctx.school.id, who: `${ctx.teacher.firstName} ${ctx.teacher.lastName}`, ctx };
}

/* ───────────────────────── Loading ───────────────────────── */

const examInclude = {
  sections: { include: { section: { include: { class: true } } } },
  papers: { include: { subject: { select: { name: true } } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] },
  session: { select: { name: true, startDate: true, endDate: true } },
} satisfies Prisma.ExamInclude;

export type LoadedExam = Prisma.ExamGetPayload<{ include: typeof examInclude }>;

export function loadExam(schoolId: string, id: string) {
  return db.exam.findFirst({ where: { id, schoolId }, include: examInclude });
}

/** An exam's classes (in class order) with the sections it covers. */
export function examClasses(exam: LoadedExam) {
  const byClass = new Map<string, { id: string; name: string; sortOrder: number; sections: { id: string; name: string }[] }>();
  for (const { section } of exam.sections) {
    const c = byClass.get(section.classId) ?? { id: section.classId, name: section.class.name, sortOrder: section.class.sortOrder, sections: [] };
    c.sections.push({ id: section.id, name: section.name });
    byClass.set(section.classId, c);
  }
  return [...byClass.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((c) => ({ ...c, sections: c.sections.sort((a, b) => a.name.localeCompare(b.name)) }));
}

export type ExamClass = ReturnType<typeof examClasses>[number];

/** "Class 5 – A, B" or "Class 5" when every section of the class is included. */
export function classLabel(c: ExamClass, totalSections: number) {
  return c.sections.length === totalSections ? c.name : `${c.name} – ${c.sections.map((s) => s.name).join(", ")}`;
}

export function paperViews(exam: LoadedExam): PaperView[] {
  return exam.papers.map((p) => ({
    id: p.id,
    date: isoDate(p.date),
    startTime: p.startTime,
    endTime: p.endTime,
    classId: p.classId,
    subject: paperName(p.subject?.name, p.title),
    maxMarks: p.maxMarks,
    room: p.room,
    notes: p.notes,
  }));
}

export function paperInputs(exam: LoadedExam): PaperInput[] {
  return exam.papers.map((p) => ({
    id: p.id,
    date: isoDate(p.date),
    startTime: p.startTime,
    endTime: p.endTime,
    classId: p.classId ?? "",
    subjectId: p.subjectId ?? "",
    title: p.title ?? "",
    maxMarks: p.maxMarks == null ? "" : String(p.maxMarks),
    room: p.room ?? "",
    notes: p.notes ?? "",
  }));
}

/** The school's name, address and logo for printed sheets. */
export async function schoolHeader(schoolId: string) {
  const school = await db.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { id: true, name: true, address: true, phone: true, email: true, logo: { select: { updatedAt: true } } },
  });
  return {
    name: school.name,
    address: school.address,
    contact: [school.phone, school.email].filter(Boolean).join(" · "),
    logoUrl: school.logo ? `/api/schools/${school.id}/logo?v=${school.logo.updatedAt.getTime()}` : null,
  };
}

/** Everything the print view needs, as plain data. */
export async function printData(exam: LoadedExam) {
  const classes = examClasses(exam);
  const sectionCounts = await db.section.groupBy({ by: ["classId"], where: { classId: { in: classes.map((c) => c.id) } }, _count: true });
  const total = new Map(sectionCounts.map((s) => [s.classId, s._count]));
  return {
    school: await schoolHeader(exam.schoolId),
    exam: { name: exam.name, kind: exam.kind, session: exam.session.name, instructions: exam.instructions },
    classes: classes.map((c) => ({ id: c.id, label: classLabel(c, total.get(c.id) ?? c.sections.length) })),
    papers: paperViews(exam),
    settings: readPrintSettings(exam.printSettings),
  };
}

export type PrintData = Awaited<ReturnType<typeof printData>>;

/* ───────────────────────── Permissions ───────────────────────── */

/** Sections the actor may put an exam in, grouped by class. */
export async function pickableSections(actor: ExamActor) {
  const classes = await db.schoolClass.findMany({
    where: { schoolId: actor.schoolId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sections: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });
  if (actor.kind === "admin") return classes;
  const allowed = actor.ctx.visibleSectionIds;
  return classes
    .map((c) => ({ ...c, sections: c.sections.filter((s) => allowed.has(s.id)) }))
    .filter((c) => c.sections.length);
}

/**
 * Subjects a paper may be set in, per exam class ("" = a paper for every class).
 * Admins: any school subject (the class's own subjects are listed first).
 * Teachers: in their class-teacher section any subject of the class; elsewhere
 * only the subjects they teach there.
 */
export async function subjectOptions(actor: ExamActor, sectionIds: string[]) {
  const sections = await db.section.findMany({
    where: { id: { in: sectionIds }, class: { schoolId: actor.schoolId } },
    select: { id: true, classId: true, class: { select: { subjects: { select: { subjectId: true } } } } },
  });
  const subjects = await db.subject.findMany({ where: { schoolId: actor.schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });

  const perSection = new Map<string, Set<string>>();
  for (const s of sections) {
    const curriculum = s.class.subjects.map((cs) => cs.subjectId);
    if (actor.kind === "admin") perSection.set(s.id, new Set(subjects.map((x) => x.id)));
    else if (actor.ctx.classSection?.id === s.id) perSection.set(s.id, new Set(curriculum));
    else {
      const taught = await db.subjectTeacherAssignment.findMany({ where: { teacherId: actor.ctx.teacher.id, sectionId: s.id }, select: { subjectId: true } });
      perSection.set(s.id, new Set(taught.map((t) => t.subjectId)));
    }
  }

  // A paper for a class must be allowed in every chosen section of that class.
  const intersect = (sets: Set<string>[]) =>
    sets.length ? [...sets[0]].filter((id) => sets.every((set) => set.has(id))) : [];
  const allowed: Record<string, string[]> = {};
  const curricula: Record<string, string[]> = {};
  for (const classId of new Set(sections.map((s) => s.classId))) {
    const inClass = sections.filter((s) => s.classId === classId);
    allowed[classId] = intersect(inClass.map((s) => perSection.get(s.id)!));
    curricula[classId] = inClass[0].class.subjects.map((cs) => cs.subjectId);
  }
  allowed[""] = intersect(sections.map((s) => perSection.get(s.id)!));
  curricula[""] = [...new Set(Object.values(curricula).flat())];
  return { subjects, allowed, curricula };
}

/** Whether the actor may change this exam: admins any; teachers only their own tests. */
export function canEdit(actor: ExamActor, exam: { kind: ExamKind; teacherId: string | null }) {
  return actor.kind === "admin" || (exam.kind === "TEST" && exam.teacherId === actor.ctx.teacher.id);
}

/**
 * Whether a teacher may open an exam: their own tests, other teachers' tests
 * for a section they teach (to enter marks or publish results), and published
 * school exams for a section they teach.
 */
export function teacherCanView(ctx: TeacherContext, exam: { kind: ExamKind; teacherId: string | null; published: boolean; sections: { sectionId: string }[] }) {
  if (exam.kind === "TEST" && exam.teacherId === ctx.teacher.id) return true;
  if (exam.kind === "EXAM" && !exam.published) return false;
  return exam.sections.some((s) => ctx.visibleSectionIds.has(s.sectionId));
}

/* ───────────────────────── Details ───────────────────────── */

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Give it a name, e.g. Half-yearly examination").max(100, "Keep the name under 100 characters"),
  instructions: z
    .string()
    .trim()
    .max(2000, "Keep instructions under 2000 characters")
    .optional()
    .transform((v) => v || null),
});

/** Validated name, instructions and sections from the details form. */
async function readDetails(actor: ExamActor, formData: FormData) {
  const parsed = detailsSchema.safeParse({ name: formData.get("name") ?? "", instructions: formData.get("instructions") ?? "" });
  if (!parsed.success) return { state: validationError(parsed.error) };
  const requested = [...new Set(formData.getAll("sectionIds").map(String))];
  const allowed = new Set((await pickableSections(actor)).flatMap((c) => c.sections.map((s) => s.id)));
  const sectionIds = requested.filter((id) => allowed.has(id));
  if (!sectionIds.length) {
    const message = "Choose at least one class or section";
    return { state: { error: message, fieldErrors: { sectionIds: [message] } } satisfies ActionState };
  }
  return { data: { ...parsed.data, sectionIds } };
}

export async function createExamRecord(actor: ExamActor, sessionId: string, formData: FormData) {
  const details = await readDetails(actor, formData);
  if (!details.data) return { state: details.state };
  const { sectionIds, ...data } = details.data;
  const exam = await db.exam.create({
    data: {
      ...data,
      schoolId: actor.schoolId,
      sessionId,
      kind: actor.kind === "admin" ? "EXAM" : "TEST",
      teacherId: actor.kind === "teacher" ? actor.ctx.teacher.id : null,
      // Teachers' tests are theirs to share; admin exams start as drafts.
      published: actor.kind === "teacher",
      createdBy: actor.who,
      sections: { create: sectionIds.map((sectionId) => ({ sectionId })) },
    },
  });
  return { id: exam.id };
}

export async function updateExamDetailsRecord(actor: ExamActor, exam: LoadedExam, formData: FormData): Promise<ActionState> {
  const details = await readDetails(actor, formData);
  if (!details.data) return details.state;
  const { sectionIds, ...data } = details.data;

  // Papers for a class that is being dropped must be removed first.
  const kept = await db.section.findMany({ where: { id: { in: sectionIds } }, select: { classId: true } });
  const keptClasses = new Set(kept.map((s) => s.classId));
  const orphaned = exam.papers.filter((p) => p.classId && !keptClasses.has(p.classId));
  if (orphaned.length) {
    const names = [...new Set(exam.sections.filter((s) => orphaned.some((p) => p.classId === s.section.classId)).map((s) => s.section.class.name))];
    const message = `The timetable has ${orphaned.length} paper(s) for ${names.join(", ")}. Remove them from the timetable before removing the class.`;
    return { error: message, fieldErrors: { sectionIds: [message] } };
  }

  await db.$transaction([
    db.exam.update({ where: { id: exam.id }, data }),
    db.examSection.deleteMany({ where: { examId: exam.id, sectionId: { notIn: sectionIds } } }),
    db.examSection.createMany({ data: sectionIds.map((sectionId) => ({ examId: exam.id, sectionId })), skipDuplicates: true }),
  ]);
  return { ok: true, message: "Details saved." };
}

/* ───────────────────────── Timetable ───────────────────────── */

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/**
 * Validates the whole date sheet. Errors are keyed "papers.<row>.<field>" so the
 * editor can mark the exact cell.
 */
export async function saveTimetableRecord(actor: ExamActor, exam: LoadedExam, formData: FormData): Promise<ActionState> {
  let rows: PaperInput[];
  try {
    const raw = JSON.parse(String(formData.get("papers") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error();
    rows = raw.map((r) => ({
      id: String(r?.id ?? ""),
      date: String(r?.date ?? "").trim(),
      startTime: String(r?.startTime ?? "").trim(),
      endTime: String(r?.endTime ?? "").trim(),
      classId: String(r?.classId ?? ""),
      subjectId: String(r?.subjectId ?? ""),
      title: String(r?.title ?? "").trim(),
      maxMarks: String(r?.maxMarks ?? "").trim(),
      room: String(r?.room ?? "").trim(),
      notes: String(r?.notes ?? "").trim(),
    }));
  } catch {
    return { error: "The timetable could not be read. Reload the page and try again." };
  }
  if (rows.length > MAX_PAPERS) return { error: `A timetable can have at most ${MAX_PAPERS} papers.` };

  const classes = examClasses(exam);
  const classIds = new Set(classes.map((c) => c.id));
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const { subjects, allowed } = await subjectOptions(actor, exam.sections.map((s) => s.sectionId));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const start = isoDate(exam.session.startDate);
  const end = isoDate(exam.session.endDate);

  const errors: Record<string, string[]> = {};
  const fail = (i: number, field: keyof PaperInput, message: string) => {
    errors[`papers.${i}.${field}`] ??= [message];
  };

  rows.forEach((r, i) => {
    if (!parseISODate(r.date)) fail(i, "date", "Choose a date");
    else if (r.date < start || r.date > end) fail(i, "date", `Must be in session ${exam.session.name}`);
    if (!TIME.test(r.startTime)) fail(i, "startTime", "Choose a start time");
    if (!TIME.test(r.endTime)) fail(i, "endTime", "Choose an end time");
    else if (TIME.test(r.startTime) && minutes(r.endTime) <= minutes(r.startTime)) fail(i, "endTime", "Must be after the start time");
    if (r.classId && !classIds.has(r.classId)) fail(i, "classId", "This class isn't in the exam");
    if (!r.subjectId && !r.title) fail(i, "subjectId", "Choose a subject or type a paper name");
    if (r.subjectId) {
      if (!subjectName.has(r.subjectId)) fail(i, "subjectId", "Subject not found");
      else if (!(allowed[r.classId] ?? []).includes(r.subjectId)) {
        fail(i, "subjectId", actor.kind === "teacher" ? "You don't teach this subject in every chosen section" : "Not available for this class");
      }
    }
    if (r.title.length > 60) fail(i, "title", "Keep it under 60 characters");
    if (r.maxMarks && !(/^\d{1,4}$/.test(r.maxMarks) && Number(r.maxMarks) >= 1 && Number(r.maxMarks) <= 1000)) {
      fail(i, "maxMarks", "1 to 1000");
    }
    if (r.room.length > 40) fail(i, "room", "Keep it under 40 characters");
    if (r.notes.length > 120) fail(i, "notes", "Keep it under 120 characters");
  });

  // A class can't sit two papers at once. A paper for every class clashes with all of them.
  if (!Object.keys(errors).length) {
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < i; j++) {
        const [a, b] = [rows[i], rows[j]];
        if (a.date !== b.date) continue;
        if (a.classId && b.classId && a.classId !== b.classId) continue;
        if (minutes(a.startTime) >= minutes(b.endTime) || minutes(b.startTime) >= minutes(a.endTime)) continue;
        const who = a.classId || b.classId ? className.get(a.classId || b.classId) : "every class";
        const other = paperName(subjectName.get(b.subjectId), b.title);
        fail(i, "startTime", `Clashes with row ${j + 1} (${other}, ${timeRange(b.startTime, b.endTime)}) for ${who}`);
        break;
      }
    }
  }

  // Papers keep their id (and marks) across saves. A paper with marks can't be
  // removed or moved to another class/subject, nor its max marks cut below a mark.
  const existing = new Map(exam.papers.map((p) => [p.id, p]));
  const marked = new Map(
    (await db.examMark.groupBy({ by: ["paperId"], where: { paperId: { in: [...existing.keys()] } }, _max: { marks: true }, _count: true })).map((m) => [
      m.paperId,
      { count: m._count, max: m._max.marks ?? 0 },
    ]),
  );
  const published = (await db.examResult.count({ where: { examId: exam.id } })) > 0;
  const kept = new Set<string>();
  rows.forEach((r, i) => {
    const before = existing.get(r.id);
    if (!before || kept.has(r.id)) {
      r.id = ""; // new row (or a copy of one)
      return;
    }
    kept.add(r.id);
    const m = marked.get(r.id);
    if (!m) return;
    if ((r.classId || null) !== before.classId) fail(i, "classId", "Marks are entered for this paper, so its class can't change");
    if ((r.subjectId || null) !== before.subjectId) fail(i, "subjectId", "Marks are entered for this paper, so its subject can't change");
    const max = r.maxMarks ? Number(r.maxMarks) : null;
    if (max !== before.maxMarks) {
      if (published) fail(i, "maxMarks", "Results are published; unpublish them to change max marks");
      else if (max == null || max < m.max) fail(i, "maxMarks", `Marks up to ${m.max} are entered; can't go below that`);
    }
  });
  const removed = exam.papers.filter((p) => !kept.has(p.id));
  const blocked = removed.filter((p) => marked.has(p.id));

  if (Object.keys(errors).length) {
    const count = new Set(Object.keys(errors).map((k) => k.split(".")[1])).size;
    return { error: `Fix ${count} row${count === 1 ? "" : "s"} in the timetable.`, fieldErrors: errors };
  }
  if (blocked.length) {
    const names = blocked.map((p) => `${paperName(p.subject?.name, p.title)} (${isoDate(p.date)})`).join(", ");
    return { error: `Marks are entered for ${names}, so ${blocked.length === 1 ? "it" : "they"} can't be removed. Clear the marks first, or keep the paper.` };
  }

  const data = (r: PaperInput) => ({
    date: parseISODate(r.date)!,
    startTime: r.startTime,
    endTime: r.endTime,
    classId: r.classId || null,
    subjectId: r.subjectId || null,
    title: r.title || null,
    maxMarks: r.maxMarks ? Number(r.maxMarks) : null,
    room: r.room || null,
    notes: r.notes || null,
  });
  await db.$transaction([
    db.examPaper.deleteMany({ where: { id: { in: removed.map((p) => p.id) } } }),
    ...rows.filter((r) => r.id).map((r) => db.examPaper.update({ where: { id: r.id }, data: data(r) })),
    db.examPaper.createMany({ data: rows.filter((r) => !r.id).map((r) => ({ examId: exam.id, ...data(r) })) }),
    db.exam.update({ where: { id: exam.id }, data: { updatedAt: new Date() } }),
  ]);
  return { ok: true, message: rows.length ? `Timetable saved: ${rows.length} paper${rows.length === 1 ? "" : "s"}.` : "Timetable cleared." };
}

/** Saves print options (already clamped by readPrintSettings). */
export async function savePrintSettingsRecord(examId: string, raw: unknown) {
  await db.exam.update({ where: { id: examId }, data: { printSettings: readPrintSettings(raw) } });
}

/* ───────────────────────── Lists ───────────────────────── */

/** Exams/tests for the list pages, with their classes and date range. */
export async function listSummaries(where: Prisma.ExamWhereInput, paging?: { skip: number; take: number }) {
  const exams = await db.exam.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(paging && { skip: paging.skip, take: paging.take }),
    include: {
      sections: { include: { section: { include: { class: true } } } },
      papers: { select: { date: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  return exams.map((e) => {
    const dates = e.papers.map((p) => isoDate(p.date));
    return {
      id: e.id,
      name: e.name,
      kind: e.kind,
      published: e.published,
      createdBy: e.createdBy,
      teacherId: e.teacherId,
      papers: e.papers.length,
      dates,
      sections: e.sections
        .map((s) => s.section)
        .sort((a, b) => a.class.sortOrder - b.class.sortOrder || a.name.localeCompare(b.name))
        .map((s) => sectionLabel(s)),
    };
  });
}

export type ExamSummary = Awaited<ReturnType<typeof listSummaries>>[number];
