import { notFound } from "next/navigation";
import { MarksPageContent } from "@/components/exams/marks-page";
import { loadExam } from "@/lib/exams";
import { sectionLabel } from "@/lib/queries";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { publishExamResults, saveExamMarks, unpublishExamResults } from "../../../../exams/actions";

/** Marks entry for one section, inside Marks & results. */
export default async function SectionMarksPage({ params }: PageProps<"/admin/results/[examId]/[sectionId]/marks">) {
  const { examId, sectionId } = await params;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, examId);
  if (!exam) notFound();
  const section = exam.sections.find((s) => s.sectionId === sectionId)?.section;
  if (!section) notFound();
  const viewer = await getViewer();
  const base = `/admin/results/${exam.id}`;
  return (
    <MarksPageContent
      actor={{ kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" }}
      exam={exam}
      sectionId={sectionId}
      crumbs={[
        { label: "Marks & results", href: exam.kind === "TEST" ? "/admin/results?kind=tests" : "/admin/results" },
        { label: exam.name, href: base },
        { label: `Results · ${sectionLabel(section)}`, href: `${base}/${sectionId}` },
      ]}
      save={saveExamMarks.bind(null, exam.id, sectionId)}
      publish={publishExamResults.bind(null, exam.id, sectionId)}
      unpublish={unpublishExamResults.bind(null, exam.id, sectionId)}
      resultsHref={`${base}/${sectionId}`}
    />
  );
}
