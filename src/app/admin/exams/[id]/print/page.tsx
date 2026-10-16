import { notFound } from "next/navigation";
import { TimetablePrint } from "@/components/exams/timetable-print";
import { loadExam, printData } from "@/lib/exams";
import { getCurrentSchool } from "@/lib/school";
import { saveExamPrintSettings } from "../../actions";

export default async function ExamPrintPage({ params, searchParams }: PageProps<"/admin/exams/[id]/print">) {
  const { id } = await params;
  const { from } = await searchParams;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, id);
  if (!exam) notFound();
  return (
    <TimetablePrint data={await printData(exam)} save={saveExamPrintSettings.bind(null, exam.id)} backHref={from === "list" ? (exam.kind === "TEST" ? "/admin/exams?kind=tests" : "/admin/exams") : `/admin/exams/${exam.id}`} />
  );
}
