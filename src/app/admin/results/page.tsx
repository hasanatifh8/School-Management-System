import { FileBarChart } from "lucide-react";
import { ExamBoard } from "@/components/exams/exam-board";
import { ButtonLink, Card, EmptyState, PageHeader, StatusTab, tabBarClass } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { listSummaries } from "@/lib/exams";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";

/** Marks & results, step 1: choose an exam (or a teacher's test). */
export default async function ResultsExamsPage({ searchParams }: PageProps<"/admin/results">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const session = await getCurrentSession(school.id);
  const tests = params.kind === "tests";
  const base = { schoolId: school.id, sessionId: session.id };

  const [examCount, testCount] = await Promise.all([
    db.exam.count({ where: { ...base, kind: "EXAM" } }),
    db.exam.count({ where: { ...base, kind: "TEST" } }),
  ]);
  // The whole session's list: searched and filtered on the page (a session has a few dozen at most).
  const exams = await listSummaries({ ...base, kind: tests ? "TEST" : "EXAM" });

  return (
    <>
      <PageHeader
        title="Marks & results"
        subtitle={`Enter marks, publish results and print report cards for session ${session.name}. Choose an exam, then a class and section.`}
      />
      <div className="mb-6 border-b border-line">
        <nav aria-label="Exams or tests" className={tabBarClass}>
          <StatusTab replace href="/admin/results" active={!tests} label="School exams" count={examCount} />
          <StatusTab replace href="/admin/results?kind=tests" active={tests} label="Teachers' tests" count={testCount} />
        </nav>
      </div>
      {exams.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileBarChart}
            title={tests ? "No class tests yet" : "No exams yet"}
            description={tests ? "Tests that teachers schedule for their classes appear here." : "Create an exam and its date sheet first. Its marks and results are managed here."}
            action={tests ? undefined : <ButtonLink href="/admin/exams/new">New exam</ButtonLink>}
          />
        </Card>
      ) : (
        <ExamBoard key={tests ? "tests" : "exams"} exams={exams} today={todayISO()} mode="results" openBase="/admin/results/" showAuthor={tests} />
      )}
    </>
  );
}
