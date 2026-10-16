import { ClipboardList, Plus } from "lucide-react";
import { ExamBoard } from "@/components/exams/exam-board";
import { ButtonLink, Card, EmptyState, PageHeader, StatusTab, tabBarClass } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { listSummaries } from "@/lib/exams";
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
  // The whole session's list: searched and filtered on the page (a session has a few dozen at most).
  const exams = await listSummaries({ ...base, kind: tests ? "TEST" : "EXAM" });

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
      <div className="mb-6 border-b border-line">
        <nav aria-label="Exams or tests" className={tabBarClass}>
          <StatusTab replace href="/admin/exams" active={!tests} label="School exams" count={examCount} />
          <StatusTab replace href="/admin/exams?kind=tests" active={tests} label="Teachers' tests" count={testCount} />
        </nav>
      </div>
      {exams.length === 0 ? (
        <Card>
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
        </Card>
      ) : (
        <ExamBoard key={tests ? "tests" : "exams"} exams={exams} today={todayISO()} mode="exams" openBase="/admin/exams/" printBase="/admin/exams/" showAuthor={tests} />
      )}
    </>
  );
}
