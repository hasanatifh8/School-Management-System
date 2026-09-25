import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ImageOff, School } from "lucide-react";
import { IdCardSteps } from "@/components/id-card/steps";
import { StudentPicker } from "@/components/id-card/student-picker";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { MAX_CARDS_PER_BATCH, loadIdCardRoster } from "@/lib/id-cards";
import { sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

const STEPS = [{ label: "Choose class", href: "/admin/id-cards" }, { label: "Pick students" }, { label: "Download or print" }];

/** Step 1: choose a class. Step 2 (?section=): pick students. */
export default async function IdCardsPage({ searchParams }: PageProps<"/admin/id-cards">) {
  const sp = await searchParams;
  const school = await getCurrentSchool();

  if (typeof sp.section === "string") {
    const section = await db.section.findFirst({ where: { id: sp.section, class: { schoolId: school.id } }, include: { class: true } });
    if (!section) notFound();
    const students = await loadIdCardRoster(school.id, section.id);
    return (
      <>
        <PageHeader title="ID cards" breadcrumbs={[{ label: "ID cards", href: "/admin/id-cards" }, { label: sectionLabel(section) }]} subtitle={`${sectionLabel(section)} · ${students.length} students`} />
        <IdCardSteps steps={STEPS} current={1} />
        {students.length ? (
          <StudentPicker students={students} generatePath="/admin/id-cards/generate" profilePath="/admin/students" max={MAX_CARDS_PER_BATCH} />
        ) : (
          <Card>
            <EmptyState icon={School} title="No students in this class" />
          </Card>
        )}
      </>
    );
  }

  const [classes, noPhoto] = await Promise.all([
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { sections: { orderBy: { name: "asc" }, include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } } },
    }),
    db.student.groupBy({ by: ["sectionId"], where: { schoolId: school.id, status: "ACTIVE", photoId: null }, _count: true }),
  ]);
  const missingPhotos = new Map(noPhoto.map((g) => [g.sectionId, g._count]));
  const sections = classes.flatMap((c) => c.sections.map((s) => ({ ...s, class: c })));

  return (
    <>
      <PageHeader title="ID cards" subtitle="Make student ID cards class by class, then download them as images or print them." />
      <IdCardSteps steps={STEPS} current={0} />
      {sections.length === 0 ? (
        <Card>
          <EmptyState icon={School} title="No classes yet" description="Create classes and add students first." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => {
            const missing = missingPhotos.get(s.id) ?? 0;
            const empty = s._count.students === 0;
            return (
              <Link
                key={s.id}
                href={`/admin/id-cards?section=${s.id}`}
                aria-disabled={empty}
                className={`group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md ${empty ? "pointer-events-none opacity-50" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{sectionLabel(s)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    {s._count.students} student{s._count.students === 1 ? "" : "s"}
                    {missing > 0 && (
                      <Badge tone="amber">
                        <ImageOff className="h-3 w-3" />
                        {missing} without photo
                      </Badge>
                    )}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
