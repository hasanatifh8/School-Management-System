import { notFound } from "next/navigation";
import { ResultsPageContent } from "@/components/exams/marks-page";
import { loadExam } from "@/lib/exams";
import { getCurrentSchool } from "@/lib/school";

export default async function ExamResultsPage({ params, searchParams }: PageProps<"/admin/exams/[id]/results/[sectionId]">) {
  const { id, sectionId } = await params;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, id);
  if (!exam) notFound();
  return (
    <ResultsPageContent
      actor={{ kind: "admin", schoolId: school.id, who: "" }}
      exam={exam}
      sectionId={sectionId}
      params={await searchParams}
      marksHref={`/admin/exams/${exam.id}/marks/${sectionId}`}
      baseHref={`/admin/exams/${exam.id}/results/${sectionId}`}
    />
  );
}
