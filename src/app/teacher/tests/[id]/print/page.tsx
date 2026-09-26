import { notFound } from "next/navigation";
import { TimetablePrint } from "@/components/exams/timetable-print";
import { canEdit, loadExam, printData, teacherActor, teacherCanView } from "@/lib/exams";
import { requireTeacher } from "@/lib/teacher-auth";
import { saveTestPrintSettings } from "../../actions";

export default async function TestPrintPage({ params }: PageProps<"/teacher/tests/[id]/print">) {
  const { id } = await params;
  const ctx = await requireTeacher();
  const exam = await loadExam(ctx.school.id, id);
  if (!exam || !teacherCanView(ctx, exam)) notFound();
  const own = canEdit(teacherActor(ctx), exam);
  return (
    <TimetablePrint
      data={await printData(exam)}
      save={own ? saveTestPrintSettings.bind(null, exam.id) : undefined}
      backHref={`/teacher/tests/${exam.id}`}
    />
  );
}
