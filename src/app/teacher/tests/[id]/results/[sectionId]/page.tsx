import { notFound } from "next/navigation";
import { ResultsPageContent } from "@/components/exams/marks-page";
import { loadExam, teacherActor, teacherCanView } from "@/lib/exams";
import { requireTeacher } from "@/lib/teacher-auth";

export default async function TeacherResultsPage({ params, searchParams }: PageProps<"/teacher/tests/[id]/results/[sectionId]">) {
  const { id, sectionId } = await params;
  const ctx = await requireTeacher();
  const exam = await loadExam(ctx.school.id, id);
  if (!exam || !teacherCanView(ctx, exam)) notFound();
  return (
    <ResultsPageContent
      actor={teacherActor(ctx)}
      exam={exam}
      sectionId={sectionId}
      params={await searchParams}
      marksHref={`/teacher/tests/${exam.id}/marks/${sectionId}`}
      baseHref={`/teacher/tests/${exam.id}/results/${sectionId}`}
    />
  );
}
