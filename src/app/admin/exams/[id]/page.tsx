import { notFound } from "next/navigation";
import { EyeOff, Send, Trash2 } from "lucide-react";
import { ExamWorkspace } from "@/components/exams/exam-workspace";
import { MarksOverview } from "@/components/exams/marks-overview";
import { marksOverview } from "@/lib/exam-marks";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { loadExam } from "@/lib/exams";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { deleteExam, saveExamTimetable, setExamPublished, updateExamDetails } from "../actions";

export default async function ExamPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, id);
  if (!exam) notFound();
  const viewer = await getViewer();
  const isExam = exam.kind === "EXAM";
  const actor = { kind: "admin" as const, schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" };
  const overview = await marksOverview(actor, exam);

  return (
    <>
      <PageHeader
        title={isExam ? "Exam" : "Class test"}
        breadcrumbs={[
          { label: "Exams & tests", href: "/admin/exams" },
          ...(isExam ? [] : [{ label: "Teachers' tests", href: "/admin/exams?kind=tests" }]),
          { label: exam.name },
        ]}
      />
      <ExamWorkspace
        exam={exam}
        actor={actor}
        saveTimetable={saveExamTimetable.bind(null, exam.id)}
        saveDetails={updateExamDetails.bind(null, exam.id)}
        printHref={`/admin/exams/${exam.id}/print`}
        actions={
          <>
            {isExam && (
              <ActionForm action={setExamPublished.bind(null, exam.id, !exam.published)} compact className="flex items-center gap-2">
                {exam.published ? (
                  <SubmitButton variant="ghost" icon={<EyeOff className="h-4 w-4" />}>
                    Unpublish
                  </SubmitButton>
                ) : (
                  <SubmitButton icon={<Send className="h-4 w-4" />}>Publish to teachers</SubmitButton>
                )}
              </ActionForm>
            )}
            <ActionForm action={deleteExam.bind(null, exam.id)} compact className="flex items-center gap-2">
              <SubmitButton
                variant="dangerGhost"
                confirm={`Delete “${exam.name}” with its timetable, marks and results? This can't be undone.`}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Delete
              </SubmitButton>
            </ActionForm>
          </>
        }
      >
        <MarksOverview rows={overview} base={`/admin/exams/${exam.id}`} />
      </ExamWorkspace>
    </>
  );
}
