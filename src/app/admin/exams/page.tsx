import { ClipboardList, Plus } from "lucide-react";
import { ExamList } from "@/components/exams/exam-list";
import { Pagination } from "@/components/pagination";
import { ButtonLink, Card, EmptyState, PageHeader, StatusTab } from "@/components/ui";
import { db } from "@/lib/db";
import { listSummaries } from "@/lib/exams";
import { paginate } from "@/lib/pagination";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";

/** Exams scheduled by the school, and class tests created by teachers, for the current session. */
export default async function ExamsPage({ searchParams }: PageProps<"/admin/exams">) {
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
        title="Exams & tests"
        subtitle={`Date sheets for session ${session.name}. Print them for notice boards and students.`}
        action={
          <ButtonLink href="/admin/exams/new" icon={Plus}>
            New exam
          </ButtonLink>
        }
      />
      <Card padded={false}>
        <div className="flex gap-6 border-b border-slate-100 px-6 pt-4 text-sm font-medium">
          <StatusTab href="/admin/exams" active={!tests} label="School exams" count={examCount} />
          <StatusTab href="/admin/exams?kind=tests" active={tests} label="Teachers' tests" count={testCount} />
        </div>
        {exams.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={tests ? "No class tests yet" : "No exams yet"}
            description={
              tests
                ? "Tests that teachers schedule for their classes appear here."
                : "Create an exam, choose its classes and build the date sheet. It stays a draft until you publish it to teachers."
            }
            action={
              tests ? undefined : (
                <ButtonLink href="/admin/exams/new" icon={Plus}>
                  New exam
                </ButtonLink>
              )
            }
          />
        ) : (
          <ExamList
            exams={exams}
            href={(e) => `/admin/exams/${e.id}`}
            printHref={(e) => `/admin/exams/${e.id}/print`}
            showAuthor={tests}
          />
        )}
        <Pagination paging={paging} noun={tests ? "tests" : "exams"} />
      </Card>
    </>
  );
}
