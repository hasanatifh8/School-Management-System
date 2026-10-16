import { notFound } from "next/navigation";
import { TimetablePrint } from "@/components/exams/timetable-print";
import { canEdit, loadExam, printData, teacherActor, teacherCanView } from "@/lib/exams";
import { requireTeacher } from "@/lib/teacher-auth";
import { saveTestPrintSettings } from "../../actions";

export default async function TestPrintPage({ params, searchParams }: PageProps<"/teacher/tests/[id]/print">) {
  const { id } = await params;
  const { from } = await searchParams;
  const ctx = await requireTeacher();
  const exam = await loadExam(ctx.school.id, id);
  if (!exam || !teacherCanView(ctx, exam)) notFound();
  const own = canEdit(teacherActor(ctx), exam);
  return (
    <TimetablePrint
      data={await printData(exam)}
      save={own ? saveTestPrintSettings.bind(null, exam.id) : undefined}
      // Opened from the list's print icon: Back returns to the list, else to the test.
      backHref={from === "list" ? "/teacher/tests" : `/teacher/tests/${exam.id}`}
    />
  );
}
