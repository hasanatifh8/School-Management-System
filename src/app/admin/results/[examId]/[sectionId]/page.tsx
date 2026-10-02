import { notFound } from "next/navigation";
import { ResultsPageContent } from "@/components/exams/marks-page";
import { loadExam } from "@/lib/exams";
import { getCurrentSchool } from "@/lib/school";

/** Marks & results, step 3: a section's students and results (?student= opens one report card). */
export default async function SectionResultsPage({ params, searchParams }: PageProps<"/admin/results/[examId]/[sectionId]">) {
  const { examId, sectionId } = await params;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, examId);
  if (!exam) notFound();
  const base = `/admin/results/${exam.id}`;
  return (
    <ResultsPageContent
      actor={{ kind: "admin", schoolId: school.id, who: "" }}
      exam={exam}
      sectionId={sectionId}
      params={await searchParams}
      marksHref={`${base}/${sectionId}/marks`}
      baseHref={`${base}/${sectionId}`}
      back={{ href: base, label: `${exam.name}: all classes` }}
    />
  );
}
