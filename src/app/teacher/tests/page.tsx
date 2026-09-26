import { CalendarDays, ClipboardList, Plus } from "lucide-react";
import { ExamList } from "@/components/exams/exam-list";
import { Pagination } from "@/components/pagination";
import { ButtonLink, Card, EmptyState, PageHeader, StatusTab } from "@/components/ui";
import { db } from "@/lib/db";
import { listSummaries } from "@/lib/exams";
import { paginate } from "@/lib/pagination";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";

/** A teacher's own class tests, and the school's published exams for their classes. */
export default async function TeacherTestsPage({ searchParams }: PageProps<"/teacher/tests">) {
  const params = await searchParams;
  const ctx = await requireTeacher();
  const session = await getCurrentSession(ctx.school.id);
  const schoolView = params.view === "school";
  const canCreate = ctx.visibleSectionIds.size > 0;

  const mine = { schoolId: ctx.school.id, sessionId: session.id, kind: "TEST" as const, teacherId: ctx.teacher.id };
  // Published school exams and other teachers' tests for the sections this teacher teaches.
  const school = {
    schoolId: ctx.school.id,
    sessionId: session.id,
    sections: { some: { sectionId: { in: [...ctx.visibleSectionIds] } } },
    OR: [{ kind: "EXAM" as const, published: true }, { kind: "TEST" as const, teacherId: { not: ctx.teacher.id } }],
  };
  const [myCount, schoolCount] = await Promise.all([db.exam.count({ where: mine }), db.exam.count({ where: school })]);
  const paging = paginate(params, schoolView ? schoolCount : myCount);
  const exams = await listSummaries(schoolView ? school : mine, paging);

  return (
    <>
      <PageHeader
        title="Tests & exams"
        subtitle="Schedule class tests, and see and print the school's exam timetables for your classes."
        action={
          canCreate ? (
            <ButtonLink href="/teacher/tests/new" icon={Plus}>
              New test
            </ButtonLink>
          ) : undefined
        }
      />
      <Card padded={false}>
        <div className="flex gap-6 border-b border-slate-100 px-6 pt-4 text-sm font-medium">
          <StatusTab href="/teacher/tests" active={!schoolView} label="My tests" count={myCount} />
          <StatusTab href="/teacher/tests?view=school" active={schoolView} label="School exams & class tests" count={schoolCount} />
        </div>
        {exams.length === 0 ? (
          <EmptyState
            icon={schoolView ? ClipboardList : CalendarDays}
            title={schoolView ? "No school exams yet" : "No tests yet"}
            description={
              schoolView
                ? "School exams (once published) and other teachers\u2019 tests for your classes appear here. Enter marks for your subjects from each one."
                : canCreate
                  ? "Create a test for your class or the sections you teach, then add its date sheet."
                  : "You can create tests once you are a class teacher or teach a subject in a section."
            }
            action={
              !schoolView && canCreate ? (
                <ButtonLink href="/teacher/tests/new" icon={Plus}>
                  New test
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ExamList
            exams={exams}
            href={(e) => `/teacher/tests/${e.id}`}
            printHref={(e) => `/teacher/tests/${e.id}/print`}
            showAuthor={schoolView}
          />
        )}
        <Pagination paging={paging} noun={schoolView ? "exams" : "tests"} />
      </Card>
    </>
  );
}
