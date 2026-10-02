import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, School, TriangleAlert } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { examClasses, loadExam } from "@/lib/exams";
import { shortSectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

/** Admit cards, step 2: the exam's classes, each with its sections. */
export default async function AdmitCardClassesPage({ params }: PageProps<"/admin/admit-cards/[examId]">) {
  const { examId } = await params;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, examId);
  if (!exam) notFound();
  const classes = examClasses(exam);
  const counts = await db.student.groupBy({
    by: ["sectionId"],
    where: { sectionId: { in: exam.sections.map((s) => s.sectionId) }, status: "ACTIVE" },
    _count: true,
  });
  const students = new Map(counts.map((c) => [c.sectionId, c._count]));

  return (
    <>
      <PageHeader
        title={exam.name}
        subtitle="Choose a section to preview and print its admit cards."
        breadcrumbs={[{ label: "Admit cards", href: "/admin/admit-cards" }, { label: exam.name }]}
        action={
          <ButtonLink href={`/admin/exams/${exam.id}`} variant="secondary">
            Exam timetable
          </ButtonLink>
        }
      />
      {exam.papers.length === 0 && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-fg ring-1 ring-inset ring-warning-line">
          <TriangleAlert className="h-4 w-4 text-warning" />
          This exam has no papers yet, so the cards will have an empty schedule. Add the date sheet first.
        </p>
      )}
      {classes.length === 0 ? (
        <Card>
          <EmptyState icon={School} title="No classes in this exam" />
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} title={c.name} icon={School} description={`${c.sections.length} section${c.sections.length === 1 ? "" : "s"}`}>
              <ul className="grid grid-cols-2 gap-3">
                {c.sections.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/admin/admit-cards/${exam.id}/${s.id}`}
                      className="group block rounded-xl border border-line p-4 transition hover:-translate-y-px hover:border-accent-line hover:bg-accent-soft"
                    >
                      <span className="flex items-center justify-between text-lg font-semibold text-fg">
                        {shortSectionLabel(c.name, s.name)}
                        <ArrowRight className="h-4 w-4 text-subtle group-hover:text-accent-text" />
                      </span>
                      <span className="text-xs text-muted">{students.get(s.id) ?? 0} students</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
