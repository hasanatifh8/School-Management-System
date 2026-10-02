import "server-only";
// Admit cards (hall tickets): one per student of a section, with the papers of
// the exam that apply to them.
import { db } from "@/lib/db";
import { paperViews, schoolHeader, type LoadedExam } from "@/lib/exams";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";

export async function loadAdmitCards(exam: LoadedExam, sectionId: string) {
  const section = exam.sections.find((s) => s.sectionId === sectionId)?.section;
  if (!section) return null;
  const [header, school, students] = await Promise.all([
    schoolHeader(exam.schoolId),
    db.school.findUniqueOrThrow({ where: { id: exam.schoolId }, select: { principalName: true } }),
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
        guardianName: true,
        guardianRelation: true,
        photoId: true,
        subjects: { select: { subjectId: true } },
      },
    }),
  ]);

  // The class's papers, in date order; a subject paper only for students who take that subject.
  const views = new Map(paperViews(exam).map((v) => [v.id, v]));
  const papers = exam.papers.filter((p) => !p.classId || p.classId === section.classId);
  const forStudent = (taken: string[]) =>
    papers.filter((p) => !p.subjectId || !taken.length || taken.includes(p.subjectId)).map((p) => views.get(p.id)!);

  return {
    exam: { id: exam.id, name: exam.name, session: exam.session.name, instructions: exam.instructions },
    section: { id: section.id, label: sectionLabel(section) },
    school: { ...header, principalName: school.principalName },
    papers: papers.length,
    students: students.map((s) => {
      const guardian = s.guardianName
        ? { label: s.guardianRelation ? `Guardian (${s.guardianRelation})` : "Guardian", name: s.guardianName }
        : { label: "Father's name", name: s.fatherName };
      return {
        id: s.id,
        name: fullName(s),
        rollNumber: s.rollNumber,
        studentCode: s.studentCode,
        guardian,
        photoUrl: photoUrl(s.photoId),
        papers: forStudent(s.subjects.map((x) => x.subjectId)),
      };
    }),
  };
}

export type AdmitCardData = NonNullable<Awaited<ReturnType<typeof loadAdmitCards>>>;
export type AdmitCardStudent = AdmitCardData["students"][number];
