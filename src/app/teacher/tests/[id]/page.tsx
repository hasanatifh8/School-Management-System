import { notFound } from "next/navigation";
import { CalendarDays, Printer, Trash2 } from "lucide-react";
import { ExamWorkspace } from "@/components/exams/exam-workspace";
import { MarksOverview } from "@/components/exams/marks-overview";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, PageHeader } from "@/components/ui";
import { isoDate } from "@/lib/attendance-shared";
import { marksOverview } from "@/lib/exam-marks";
import { canEdit, examClasses, loadExam, teacherActor, teacherCanView } from "@/lib/exams";
import { dateSpan } from "@/lib/exams-shared";
import { requireTeacher } from "@/lib/teacher-auth";
import { deleteTest, saveTestTimetable, updateTestDetails } from "../actions";

export default async function TestPage({ params }: PageProps<"/teacher/tests/[id]">) {
  const { id } = await params;
  const ctx = await requireTeacher();
  const actor = teacherActor(ctx);
  const exam = await loadExam(ctx.school.id, id);
  if (!exam || !teacherCanView(ctx, exam)) notFound();
  const overview = await marksOverview(actor, exam);
  const base = `/teacher/tests/${exam.id}`;
  const marks = (
    <MarksOverview rows={overview} base={base} emptyText="You don't enter marks for any section of this exam." />
  );

  // Someone else's exam or test: timetable to print, and marks for the teacher's own sections.
  if (!canEdit(actor, exam)) {
    return (
      <>
        <PageHeader
          title={exam.kind === "EXAM" ? "School exam" : "Class test"}
          breadcrumbs={[{ label: "Tests & exams", href: "/teacher/tests?view=school" }, { label: exam.name }]}
        />
        <div className="space-y-6">
          <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{exam.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4" />
                {dateSpan(exam.papers.map((p) => isoDate(p.date)))} · {exam.papers.length} papers
                {exam.kind === "TEST" && ` · by ${exam.createdBy}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {examClasses(exam).map((c) => (
                  <Badge key={c.id} tone="indigo">
                    {c.name} – {c.sections.map((s) => s.name).join(", ")}
                  </Badge>
                ))}
              </div>
            </div>
            <ButtonLink href={`${base}/print`} icon={Printer} variant="secondary">
              View & print timetable
            </ButtonLink>
          </section>
          {marks}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Class test" breadcrumbs={[{ label: "Tests & exams", href: "/teacher/tests" }, { label: exam.name }]} />
      <ExamWorkspace
        exam={exam}
        actor={actor}
        saveTimetable={saveTestTimetable.bind(null, exam.id)}
        saveDetails={updateTestDetails.bind(null, exam.id)}
        printHref={`${base}/print`}
        actions={
          <ActionForm action={deleteTest.bind(null, exam.id)} compact className="flex items-center gap-2">
            <SubmitButton variant="dangerGhost" confirm={`Delete “${exam.name}” with its timetable and marks?`} icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </SubmitButton>
          </ActionForm>
        }
      >
        {marks}
      </ExamWorkspace>
    </>
  );
}
