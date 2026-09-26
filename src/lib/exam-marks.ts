import "server-only";
// Marks entry and results for exams and tests.
//
// Who may enter marks, per section:
//  - school admins: every paper;
//  - the section's class teacher: every paper of the class;
//  - the teacher who created a test: every paper of that test;
//  - a subject teacher: only papers of the subjects they teach in that section.
// Results are published per section by an admin, the class teacher or the
// test's creator, once every mark is in. Published marks are locked.
import type { ActionState } from "@/lib/action-state";
import { isoDate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { PASS_PERCENT, formatMarks, gradeFor, paperName, parseMark } from "@/lib/exams-shared";
import type { ExamActor, LoadedExam } from "@/lib/exams";
import { fullName, sectionLabel } from "@/lib/queries";

type ExamSectionRow = LoadedExam["sections"][number]["section"];

export type SectionAccess = { enterAll: boolean; subjectIds: Set<string>; canPublish: boolean; canPreview: boolean };

/** What the actor may do with marks in one section of the exam, or null for nothing. */
export async function sectionAccess(actor: ExamActor, exam: LoadedExam, section: ExamSectionRow): Promise<SectionAccess | null> {
  if (actor.kind === "admin") return { enterAll: true, subjectIds: new Set(), canPublish: true, canPreview: true };
  const { ctx } = actor;
  if (exam.kind === "EXAM" && !exam.published) return null;
  const isClassTeacher = ctx.classSection?.id === section.id;
  const isCreator = exam.kind === "TEST" && exam.teacherId === ctx.teacher.id;
  const taught = await db.subjectTeacherAssignment.findMany({ where: { teacherId: ctx.teacher.id, sectionId: section.id }, select: { subjectId: true } });
  if (!isClassTeacher && !isCreator && !taught.length) return null;
  const full = isClassTeacher || isCreator;
  return { enterAll: full, subjectIds: new Set(taught.map((t) => t.subjectId)), canPublish: full, canPreview: full };
}

const canEnterPaper = (access: SectionAccess, paper: { subjectId: string | null }) =>
  access.enterAll || (!!paper.subjectId && access.subjectIds.has(paper.subjectId));

/* ───────────────────────── Loading a section's sheet ───────────────────────── */

export type MarkCell = { marks: number | null; absent: boolean };

/** Students × graded papers of one section, with the marks entered so far. */
export async function loadSheet(actor: ExamActor, exam: LoadedExam, sectionId: string) {
  const section = exam.sections.find((s) => s.sectionId === sectionId)?.section;
  if (!section) return null;
  const access = await sectionAccess(actor, exam, section);
  if (!access) return null;

  const forClass = exam.papers.filter((p) => !p.classId || p.classId === section.classId);
  const graded = forClass.filter((p) => p.maxMarks != null);
  const [students, marks, result] = await Promise.all([
    db.student.findMany({
      where: { sectionId, status: "ACTIVE" },
      orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        rollNumber: true,
        studentCode: true,
        fatherName: true,
        motherName: true,
        dateOfBirth: true,
        photoId: true,
        subjects: { select: { subjectId: true } },
      },
    }),
    db.examMark.findMany({ where: { paperId: { in: graded.map((p) => p.id) }, student: { sectionId } } }),
    db.examResult.findUnique({ where: { examId_sectionId: { examId: exam.id, sectionId } } }),
  ]);

  // A paper applies to a student who takes its subject (or has no subjects allotted, or it has no subject).
  const eligible = (student: (typeof students)[number], paper: (typeof graded)[number]) =>
    !paper.subjectId || !student.subjects.length || student.subjects.some((s) => s.subjectId === paper.subjectId);

  return {
    exam: { id: exam.id, name: exam.name, kind: exam.kind, session: exam.session.name },
    section: { id: section.id, label: sectionLabel(section), classId: section.classId },
    access,
    papers: graded.map((p) => ({
      id: p.id,
      name: paperName(p.subject?.name, p.title),
      subjectId: p.subjectId,
      date: isoDate(p.date),
      maxMarks: p.maxMarks!,
      editable: canEnterPaper(access, p),
    })),
    ungraded: forClass.length - graded.length,
    students: students.map((s) => ({
      id: s.id,
      name: fullName(s),
      rollNumber: s.rollNumber,
      studentCode: s.studentCode,
      fatherName: s.fatherName,
      motherName: s.motherName,
      dateOfBirth: s.dateOfBirth ? isoDate(s.dateOfBirth) : null,
      photoId: s.photoId,
      eligible: graded.filter((p) => eligible(s, p)).map((p) => p.id),
    })),
    marks: Object.fromEntries(marks.map((m) => [`${m.paperId}:${m.studentId}`, { marks: m.marks, absent: m.absent } satisfies MarkCell])),
    published: result ? { at: result.publishedAt.toISOString(), by: result.publishedBy } : null,
  };
}

export type Sheet = NonNullable<Awaited<ReturnType<typeof loadSheet>>>;

/** Cells still empty: overall and among the papers the actor may edit. */
export function completion(sheet: Sheet) {
  let required = 0;
  let filled = 0;
  let mine = 0;
  let mineFilled = 0;
  const missingByPaper = new Map<string, number>();
  for (const p of sheet.papers) {
    for (const s of sheet.students) {
      if (!s.eligible.includes(p.id)) continue;
      const done = `${p.id}:${s.id}` in sheet.marks;
      required++;
      if (done) filled++;
      else missingByPaper.set(p.id, (missingByPaper.get(p.id) ?? 0) + 1);
      if (p.editable) {
        mine++;
        if (done) mineFilled++;
      }
    }
  }
  return { required, filled, mine, mineFilled, missingByPaper };
}

/* ───────────────────────── Results ───────────────────────── */

/** Totals, percentage, grade, pass/fail and rank for every student of the sheet. */
export function computeResults(sheet: Sheet) {
  const rows = sheet.students.map((s) => {
    let obtained = 0;
    let max = 0;
    let complete = true;
    const failed: string[] = [];
    const cells = sheet.papers.map((p) => {
      if (!s.eligible.includes(p.id)) return { paperId: p.id, kind: "na" as const };
      max += p.maxMarks;
      const cell = sheet.marks[`${p.id}:${s.id}`];
      if (!cell) {
        complete = false;
        return { paperId: p.id, kind: "missing" as const };
      }
      if (cell.absent) {
        failed.push(p.name);
        return { paperId: p.id, kind: "absent" as const };
      }
      const m = cell.marks ?? 0;
      obtained += m;
      const percent = (m / p.maxMarks) * 100;
      if (percent < PASS_PERCENT) failed.push(p.name);
      return { paperId: p.id, kind: "marks" as const, marks: m, grade: gradeFor(percent) };
    });
    const percent = max ? (obtained / max) * 100 : 0;
    return {
      student: s,
      cells,
      obtained,
      max,
      percent,
      grade: max ? gradeFor(percent) : "—",
      complete,
      failed,
      result: !complete ? ("Incomplete" as const) : failed.length ? ("Fail" as const) : ("Pass" as const),
      rank: null as number | null,
    };
  });
  // Rank complete results by percentage; equal percentages share a rank (1, 1, 3).
  const ranked = rows.filter((r) => r.complete && r.max).sort((a, b) => b.percent - a.percent);
  ranked.forEach((r, i) => {
    r.rank = i > 0 && Math.abs(ranked[i - 1].percent - r.percent) < 1e-9 ? ranked[i - 1].rank : i + 1;
  });
  return rows;
}

export type ResultRow = ReturnType<typeof computeResults>[number];

/* ───────────────────────── Saving ───────────────────────── */

/**
 * Saves typed marks. The form sends only changed cells as JSON
 * [{ p: paperId, s: studentId, v: "45" | "AB" | "" }]; errors are keyed "m.<paper>.<student>".
 */
export async function saveMarksRecord(actor: ExamActor, exam: LoadedExam, sectionId: string, formData: FormData): Promise<ActionState> {
  const sheet = await loadSheet(actor, exam, sectionId);
  if (!sheet) return { error: "You can't enter marks for this class." };
  if (sheet.published) return { error: "Results are published, so marks are locked. Unpublish the results to change them." };

  let entries: { p: string; s: string; v: string }[];
  try {
    const raw = JSON.parse(String(formData.get("marks") ?? "[]"));
    if (!Array.isArray(raw) || raw.length > 5000) throw new Error();
    entries = raw.map((e) => ({ p: String(e?.p ?? ""), s: String(e?.s ?? ""), v: String(e?.v ?? "") }));
  } catch {
    return { error: "The marks could not be read. Reload the page and try again." };
  }

  const papers = new Map(sheet.papers.map((p) => [p.id, p]));
  const students = new Map(sheet.students.map((s) => [s.id, s]));
  const errors: Record<string, string[]> = {};
  const upserts: { paperId: string; studentId: string; marks: number | null; absent: boolean }[] = [];
  const clears: { paperId: string; studentId: string }[] = [];
  for (const e of entries) {
    const paper = papers.get(e.p);
    const student = students.get(e.s);
    const key = `m.${e.p}.${e.s}`;
    if (!paper || !student) return { error: "The class list or timetable changed. Reload the page and try again." };
    if (!paper.editable) return { error: `You can't enter marks for ${paper.name}.` };
    if (!student.eligible.includes(paper.id)) {
      errors[key] = [`${student.name} doesn't take ${paper.name}`];
      continue;
    }
    const parsed = parseMark(e.v, paper.maxMarks);
    if ("error" in parsed) errors[key] = [parsed.error];
    else if ("empty" in parsed) clears.push({ paperId: paper.id, studentId: student.id });
    else upserts.push({ paperId: paper.id, studentId: student.id, marks: "marks" in parsed ? parsed.marks : null, absent: "absent" in parsed });
  }
  if (Object.keys(errors).length) {
    const n = Object.keys(errors).length;
    return { error: `Fix ${n} mark${n === 1 ? "" : "s"} highlighted in red.`, fieldErrors: errors };
  }
  if (!upserts.length && !clears.length) return { ok: true, message: "Nothing to save." };

  await db.$transaction([
    ...clears.map((c) => db.examMark.deleteMany({ where: c })),
    ...upserts.map((u) =>
      db.examMark.upsert({
        where: { paperId_studentId: { paperId: u.paperId, studentId: u.studentId } },
        create: { ...u, enteredBy: actor.who },
        update: { marks: u.marks, absent: u.absent, enteredBy: actor.who },
      }),
    ),
  ]);
  const n = upserts.length + clears.length;
  return { ok: true, message: `Saved ${n} mark${n === 1 ? "" : "s"}.` };
}

/** Publishes a section's results once every mark is in. */
export async function publishResultsRecord(actor: ExamActor, exam: LoadedExam, sectionId: string): Promise<ActionState> {
  const sheet = await loadSheet(actor, exam, sectionId);
  if (!sheet?.access.canPublish) return { error: "Only the class teacher or a school admin can publish these results." };
  if (sheet.published) return { ok: true, message: "Results are already published." };
  if (!sheet.papers.length) return { error: "No paper has max marks, so there is nothing to publish. Add max marks in the timetable." };
  if (!sheet.students.length) return { error: "There are no students in this section." };
  const { required, filled, missingByPaper } = completion(sheet);
  if (filled < required) {
    const list = sheet.papers
      .filter((p) => missingByPaper.has(p.id))
      .map((p) => `${p.name} (${missingByPaper.get(p.id)})`)
      .join(", ");
    return { error: `${required - filled} mark(s) are still missing: ${list}. Enter them (AB for absent) before publishing.` };
  }
  await db.examResult.create({ data: { examId: exam.id, sectionId, publishedBy: actor.who } });
  return { ok: true, message: `Results for ${sheet.section.label} are published. Marks are now locked.` };
}

export async function unpublishResultsRecord(actor: ExamActor, exam: LoadedExam, sectionId: string): Promise<ActionState> {
  const sheet = await loadSheet(actor, exam, sectionId);
  if (!sheet?.access.canPublish) return { error: "Only the class teacher or a school admin can unpublish these results." };
  await db.examResult.deleteMany({ where: { examId: exam.id, sectionId } });
  return { ok: true, message: "Results unpublished. Marks can be changed again." };
}

/* ───────────────────────── Overview ───────────────────────── */

/** One line per section the actor can work on: progress and publish state. */
export async function marksOverview(actor: ExamActor, exam: LoadedExam) {
  const out = [];
  const sections = [...exam.sections].sort(
    (a, b) => a.section.class.sortOrder - b.section.class.sortOrder || a.section.name.localeCompare(b.section.name),
  );
  for (const { section } of sections) {
    const sheet = await loadSheet(actor, exam, section.id);
    if (!sheet) continue;
    const c = completion(sheet);
    out.push({
      sectionId: section.id,
      label: sheet.section.label,
      students: sheet.students.length,
      papers: sheet.papers.length,
      required: c.required,
      filled: c.filled,
      mine: c.mine,
      mineFilled: c.mineFilled,
      editablePapers: sheet.papers.filter((p) => p.editable).length,
      access: { canPublish: sheet.access.canPublish, canPreview: sheet.access.canPreview },
      published: sheet.published,
    });
  }
  return out;
}

export type OverviewRow = Awaited<ReturnType<typeof marksOverview>>[number];

export { formatMarks };
