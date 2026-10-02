import "server-only";
// Data for the tabs of a student's profile: exams, results, notices and admit cards.
import { isoDate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { paperName } from "@/lib/exams-shared";
import { sectionLabel } from "@/lib/queries";

type ProfileStudent = {
  id: string;
  schoolId: string;
  sectionId: string | null;
  subjects: { subjectId: string }[];
  enrollments: { sectionId: string }[];
};

/** Every section the student has been in (this session and earlier ones). */
const sectionsOf = (s: ProfileStudent) => [...new Set([...(s.sectionId ? [s.sectionId] : []), ...s.enrollments.map((e) => e.sectionId)])];

/**
 * Exams and class tests for the student's sections, newest first, with only
 * the papers they sit (their class's papers, in subjects they take).
 */
export async function studentExams(student: ProfileStudent) {
  const sectionIds = sectionsOf(student);
  if (!sectionIds.length) return [];
  const taken = student.subjects.map((s) => s.subjectId);
  const exams = await db.exam.findMany({
    where: { schoolId: student.schoolId, sections: { some: { sectionId: { in: sectionIds } } } },
    include: {
      session: { select: { name: true } },
      sections: { where: { sectionId: { in: sectionIds } }, include: { section: { include: { class: true } } } },
      papers: { include: { subject: { select: { name: true } } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] },
      results: { where: { sectionId: { in: sectionIds } }, select: { sectionId: true, publishedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const today = todayISO();
  return exams.map((e) => {
    const section = e.sections[0].section;
    const papers = e.papers
      .filter((p) => (!p.classId || p.classId === section.classId) && (!p.subjectId || !taken.length || taken.includes(p.subjectId)))
      .map((p) => ({
        id: p.id,
        date: isoDate(p.date),
        startTime: p.startTime,
        endTime: p.endTime,
        name: paperName(p.subject?.name, p.title) + (p.optional ? " (Optional)" : ""),
        maxMarks: p.maxMarks,
        room: p.room,
      }));
    const first = papers[0]?.date;
    const last = papers.at(-1)?.date;
    return {
      id: e.id,
      name: e.name,
      kind: e.kind,
      published: e.published,
      session: e.session.name,
      sectionId: section.id,
      sectionLabel: sectionLabel(section),
      papers,
      status: !first ? ("unscheduled" as const) : last! < today ? ("completed" as const) : first > today ? ("upcoming" as const) : ("ongoing" as const),
      resultPublishedAt: e.results.find((r) => r.sectionId === section.id)?.publishedAt ?? null,
    };
  });
}

export type StudentExam = Awaited<ReturnType<typeof studentExams>>[number];

/** Notices that reached this student's family, newest first. */
export async function studentNotices(studentId: string) {
  return db.notice.findMany({
    where: { recipients: { some: { studentId } }, publishAt: { lte: new Date() } },
    orderBy: { publishAt: "desc" },
    take: 50,
    include: { attachment: { select: { token: true, fileName: true } } },
  });
}
