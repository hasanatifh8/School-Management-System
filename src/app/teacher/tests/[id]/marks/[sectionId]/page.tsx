import { notFound } from "next/navigation";
import { MarksPageContent } from "@/components/exams/marks-page";
import { loadExam, teacherActor, teacherCanView } from "@/lib/exams";
import { requireTeacher } from "@/lib/teacher-auth";
import { publishTeacherResults, saveTeacherMarks, unpublishTeacherResults } from "../../../actions";

export default async function TeacherMarksPage({ params }: PageProps<"/teacher/tests/[id]/marks/[sectionId]">) {
  const { id, sectionId } = await params;
  const ctx = await requireTeacher();
  const exam = await loadExam(ctx.school.id, id);
  if (!exam || !teacherCanView(ctx, exam)) notFound();
  return (
    <MarksPageContent
      actor={teacherActor(ctx)}
      exam={exam}
      sectionId={sectionId}
      crumbs={[
        { label: "Tests & exams", href: "/teacher/tests" },
        { label: exam.name, href: `/teacher/tests/${exam.id}` },
      ]}
      save={saveTeacherMarks.bind(null, exam.id, sectionId)}
      publish={publishTeacherResults.bind(null, exam.id, sectionId)}
      unpublish={unpublishTeacherResults.bind(null, exam.id, sectionId)}
      resultsHref={`/teacher/tests/${exam.id}/results/${sectionId}`}
    />
  );
}
