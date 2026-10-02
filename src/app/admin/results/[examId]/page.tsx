import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Lock, School } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { isoDate } from "@/lib/attendance-shared";
import { marksOverview, type OverviewRow } from "@/lib/exam-marks";
import { loadExam } from "@/lib/exams";
import { dateSpan } from "@/lib/exams-shared";
import { shortSectionLabel } from "@/lib/queries";
import { getCurrentSchool, getViewer } from "@/lib/school";

/** Marks & results, step 2: the exam's classes, each with its sections (1A, 1B…). */
export default async function ResultsClassesPage({ params }: PageProps<"/admin/results/[examId]">) {
  const { examId } = await params;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, examId);
  if (!exam) notFound();
  const viewer = await getViewer();
  const rows = await marksOverview({ kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" }, exam);

  // Rows come in class order; group them by class.
  const classes: { id: string; name: string; sections: OverviewRow[] }[] = [];
  for (const r of rows) {
    const last = classes.at(-1);
    if (last?.id === r.classId) last.sections.push(r);
    else classes.push({ id: r.classId, name: r.className, sections: [r] });
  }
  const base = `/admin/results/${exam.id}`;

  return (
    <>
      <PageHeader
        title={exam.name}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {dateSpan(exam.papers.map((p) => isoDate(p.date)))} · Choose a section to see its results or enter marks.
          </span>
        }
        breadcrumbs={[
          { label: "Marks & results", href: exam.kind === "TEST" ? "/admin/results?kind=tests" : "/admin/results" },
          { label: exam.name },
        ]}
        action={
          <ButtonLink href={`/admin/exams/${exam.id}`} variant="secondary">
            Exam timetable
          </ButtonLink>
        }
      />
      {classes.length === 0 ? (
        <Card>
          <EmptyState icon={School} title="No classes in this exam" description="Add classes to the exam from its details." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {classes.map((c) => {
            const published = c.sections.filter((s) => s.published).length;
            return (
              <Card
                key={c.id}
                title={c.name}
                icon={School}
                description={`${c.sections.length} section${c.sections.length === 1 ? "" : "s"} · results published for ${published}`}
              >
                <ul className="grid gap-3 sm:grid-cols-2">
                  {c.sections.map((s) => {
                    const pct = s.required ? Math.round((s.filled / s.required) * 100) : 0;
                    return (
                      <li key={s.sectionId}>
                        <Link
                          href={`${base}/${s.sectionId}`}
                          className="group block rounded-xl border border-line p-4 transition hover:-translate-y-px hover:border-accent-line hover:bg-accent-soft"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-lg font-semibold text-fg">{shortSectionLabel(s.className, s.sectionName)}</span>
                            <ArrowRight className="h-4 w-4 text-subtle group-hover:text-accent-text" />
                          </div>
                          <div className="mt-1.5">
                            {s.students === 0 ? (
                              <Badge>No students</Badge>
                            ) : s.published ? (
                              <Badge tone="green">
                                <Lock className="h-3 w-3" />
                                Published
                              </Badge>
                            ) : pct === 100 && s.required ? (
                              <Badge tone="sky" dot>
                                Ready to publish
                              </Badge>
                            ) : (
                              <Badge tone="amber" dot>
                                Marks {pct}%
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-muted">
                            {s.students} students · {s.filled}/{s.required} marks
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                            <div className={`h-full rounded-full ${pct === 100 ? "bg-success-solid" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
