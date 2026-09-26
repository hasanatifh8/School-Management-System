import { notFound } from "next/navigation";
import { MarksPageContent } from "@/components/exams/marks-page";
import { loadExam } from "@/lib/exams";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { publishExamResults, saveExamMarks, unpublishExamResults } from "../../../actions";

export default async function ExamMarksPage({ params }: PageProps<"/admin/exams/[id]/marks/[sectionId]">) {
  const { id, sectionId } = await params;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, id);
  if (!exam) notFound();
  const viewer = await getViewer();
  return (
    <MarksPageContent
      actor={{ kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" }}
      exam={exam}
      sectionId={sectionId}
      crumbs={[
        { label: "Exams & tests", href: "/admin/exams" },
        { label: exam.name, href: `/admin/exams/${exam.id}` },
      ]}
      save={saveExamMarks.bind(null, exam.id, sectionId)}
      publish={publishExamResults.bind(null, exam.id, sectionId)}
      unpublish={unpublishExamResults.bind(null, exam.id, sectionId)}
      resultsHref={`/admin/exams/${exam.id}/results/${sectionId}`}
    />
  );
}
