import { FileBarChart } from "lucide-react";
import { ExamList } from "@/components/exams/exam-list";
import { Pagination } from "@/components/pagination";
import { ButtonLink, Card, EmptyState, PageHeader, StatusTab } from "@/components/ui";
import { db } from "@/lib/db";
import { listSummaries } from "@/lib/exams";
import { paginate } from "@/lib/pagination";
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
  const paging = paginate(params, tests ? testCount : examCount);
  const exams = await listSummaries({ ...base, kind: tests ? "TEST" : "EXAM" }, paging);

  return (
    <>
      <PageHeader
        title="Marks & results"
        subtitle={`Enter marks, publish results and print report cards for session ${session.name}. Choose an exam, then a class and section.`}
      />
      <Card padded={false}>
        <div className="flex gap-6 overflow-x-auto border-b border-line px-4 pt-4 text-sm font-medium sm:px-6">
          <StatusTab href="/admin/results" active={!tests} label="School exams" count={examCount} />
          <StatusTab href="/admin/results?kind=tests" active={tests} label="Teachers' tests" count={testCount} />
        </div>
        {exams.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title={tests ? "No class tests yet" : "No exams yet"}
            description={tests ? "Tests that teachers schedule for their classes appear here." : "Create an exam and its date sheet first. Its marks and results are managed here."}
            action={tests ? undefined : <ButtonLink href="/admin/exams/new">New exam</ButtonLink>}
          />
        ) : (
          <ExamList exams={exams} href={(e) => `/admin/results/${e.id}`} showAuthor={tests} showResults />
        )}
        <Pagination paging={paging} noun={tests ? "tests" : "exams"} />
      </Card>
    </>
  );
}
