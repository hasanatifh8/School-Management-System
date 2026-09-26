import type { ReactNode } from "react";
import { CalendarDays, Printer, Settings2, Table2 } from "lucide-react";
import { ExamDetailsForm } from "@/components/exams/exam-details-form";
import { TimetableEditor } from "@/components/exams/timetable-editor";
import { Badge, ButtonLink, Card } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { isoDate, todayISO } from "@/lib/attendance-shared";
import { examClasses, paperInputs, pickableSections, subjectOptions, type ExamActor, type LoadedExam } from "@/lib/exams";
import { dateSpan } from "@/lib/exams-shared";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** The timetable editor and details form of one exam or test (admin and teacher portals). */
export async function ExamWorkspace({
  exam,
  actor,
  saveTimetable,
  saveDetails,
  printHref,
  actions,
  children,
}: {
  exam: LoadedExam;
  actor: ExamActor;
  saveTimetable: Action;
  saveDetails: Action;
  printHref: string;
  /** Extra header buttons (publish, delete…). */
  actions?: ReactNode;
  /** Shown under the timetable (marks & results). */
  children?: ReactNode;
}) {
  const classes = examClasses(exam);
  const sectionIds = exam.sections.map((s) => s.sectionId);
  const [options, pickable] = await Promise.all([subjectOptions(actor, sectionIds), pickableSections(actor)]);
  const isExam = exam.kind === "EXAM";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{exam.name}</h2>
              {isExam ? (
                exam.published ? (
                  <Badge tone="green" dot>
                    Published to teachers
                  </Badge>
                ) : (
                  <Badge tone="amber" dot>
                    Draft
                  </Badge>
                )
              ) : (
                <Badge tone="sky">Class test</Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {dateSpan(exam.papers.map((p) => isoDate(p.date)))} · {exam.papers.length} paper{exam.papers.length === 1 ? "" : "s"} · Session {exam.session.name}
              {!isExam && ` · by ${exam.createdBy}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {classes.map((c) => (
                <Badge key={c.id} tone="indigo">
                  {c.name} – {c.sections.map((s) => s.name).join(", ")}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={printHref} icon={Printer} variant="secondary">
              Print timetable
            </ButtonLink>
            {actions}
          </div>
        </div>
      </section>

      <Card
        title="Timetable"
        icon={Table2}
        description={
          classes.length > 1
            ? "Set a paper for all classes, or pick a class for class-wise papers. Papers for the same class can't overlap."
            : "One row per paper. Papers can't overlap."
        }
        padded={false}
      >
        <TimetableEditor
          action={saveTimetable}
          initial={paperInputs(exam)}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          subjects={options.subjects}
          allowed={options.allowed}
          curricula={options.curricula}
          restrict={actor.kind === "teacher"}
          sessionStart={isoDate(exam.session.startDate)}
          sessionEnd={isoDate(exam.session.endDate)}
          today={todayISO()}
        />
      </Card>

      {children}

      <Card title="Details" icon={Settings2} description="Name, classes and the instructions printed on the timetable.">
        <ExamDetailsForm
          action={saveDetails}
          classes={pickable}
          defaults={{ name: exam.name, instructions: exam.instructions, sectionIds }}
          kind={isExam ? "exam" : "test"}
          submitLabel="Save details"
        />
      </Card>
    </div>
  );
}
