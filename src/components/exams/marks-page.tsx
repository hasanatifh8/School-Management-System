import { notFound } from "next/navigation";
import { MarksGrid } from "@/components/exams/marks-grid";
import { ResultsView, type ResultsMode } from "@/components/exams/results-view";
import { Card, EmptyState, PageHeader, type Crumb } from "@/components/ui";
import { FileBarChart, PenLine } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { loadSheet } from "@/lib/exam-marks";
import { schoolHeader, type ExamActor, type LoadedExam } from "@/lib/exams";

/** Marks entry for one section (admin and teacher portals). */
export async function MarksPageContent({
  actor,
  exam,
  sectionId,
  crumbs,
  save,
  publish,
  unpublish,
  resultsHref,
}: {
  actor: ExamActor;
  exam: LoadedExam;
  sectionId: string;
  crumbs: Crumb[];
  save: (state: ActionState, formData: FormData) => Promise<ActionState>;
  publish: () => Promise<ActionState>;
  unpublish: () => Promise<ActionState>;
  resultsHref: string;
}) {
  const sheet = await loadSheet(actor, exam, sectionId);
  if (!sheet) notFound();
  const editable = sheet.papers.filter((p) => p.editable).map((p) => p.name);
  return (
    <>
      <PageHeader
        title={`Marks · ${sheet.section.label}`}
        subtitle={
          sheet.access.enterAll
            ? `${exam.name}. You can enter marks for every subject.`
            : editable.length
              ? `${exam.name}. You can enter marks for ${editable.join(", ")}; other subjects are shown read-only.`
              : `${exam.name}. You don't teach a graded subject here, so marks are read-only.`
        }
        breadcrumbs={[...crumbs, { label: `Marks · ${sheet.section.label}` }]}
      />
      <Card padded={false} title={sheet.section.label} icon={PenLine} description={`${sheet.students.length} students · ${sheet.papers.length} graded papers`}>
        <MarksGrid
          data={{
            section: { label: sheet.section.label },
            papers: sheet.papers.map(({ id, name, date, maxMarks, editable }) => ({ id, name, date, maxMarks, editable })),
            ungraded: sheet.ungraded,
            students: sheet.students.map(({ id, name, rollNumber, studentCode, eligible }) => ({ id, name, rollNumber, studentCode, eligible })),
            marks: sheet.marks,
            published: sheet.published,
            canPublish: sheet.access.canPublish,
            enterAll: sheet.access.enterAll,
          }}
          save={save}
          publish={publish}
          unpublish={unpublish}
          resultsHref={resultsHref}
        />
      </Card>
    </>
  );
}

/** Result sheet / report cards for one section, once published (or as a preview for those who publish). */
export async function ResultsPageContent({
  actor,
  exam,
  sectionId,
  params,
  marksHref,
  baseHref,
}: {
  actor: ExamActor;
  exam: LoadedExam;
  sectionId: string;
  /** The page's search params: ?view=sheet|all-cards or ?student=<id>. */
  params: Record<string, string | string[] | undefined>;
  marksHref: string;
  baseHref: string;
}) {
  const sheet = await loadSheet(actor, exam, sectionId);
  if (!sheet) notFound();
  if (!sheet.published && !sheet.access.canPreview) {
    return (
      <Card>
        <EmptyState
          icon={FileBarChart}
          title="Results aren't published yet"
          description="The class teacher publishes results once every mark is entered. You'll be able to see and print them here then."
        />
      </Card>
    );
  }
  const mode: ResultsMode =
    typeof params.student === "string"
      ? { view: "card", studentId: params.student }
      : params.view === "sheet"
        ? { view: "sheet" }
        : params.view === "all-cards"
          ? { view: "all-cards" }
          : { view: "list" };
  return <ResultsView sheet={sheet} school={await schoolHeader(exam.schoolId)} mode={mode} backHref={marksHref} baseHref={baseHref} />;
}
