import { Ticket } from "lucide-react";
import { ExamList } from "@/components/exams/exam-list";
import { Pagination } from "@/components/pagination";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { listSummaries } from "@/lib/exams";
import { paginate } from "@/lib/pagination";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";

/** Admit cards, step 1: choose a school exam. */
export default async function AdmitCardsPage({ searchParams }: PageProps<"/admin/admit-cards">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const session = await getCurrentSession(school.id);
  const where = { schoolId: school.id, sessionId: session.id, kind: "EXAM" as const };
  const paging = paginate(params, await db.exam.count({ where }));
  const exams = await listSummaries(where, paging);

  return (
    <>
      <PageHeader title="Admit cards" subtitle="Hall tickets with each student's exam schedule. Choose an exam, then a class and section." />
      <Card padded={false}>
        {exams.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No exams yet"
            description="Create an exam and its date sheet first; admit cards are made from it."
            action={<ButtonLink href="/admin/exams/new">New exam</ButtonLink>}
          />
        ) : (
          <ExamList exams={exams} href={(e) => `/admin/admit-cards/${e.id}`} />
        )}
        <Pagination paging={paging} noun="exams" />
      </Card>
    </>
  );
}
