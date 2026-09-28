import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { Breadcrumbs, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { getPeriods, loadSectionCells } from "@/lib/timetable";

/** A section's timetable laid out for printing and pinning on the class notice board. */
export default async function PrintTimetablePage({ params }: PageProps<"/admin/timetable/class/[sectionId]/print">) {
  const { sectionId } = await params;
  const school = await getCurrentSchool();
  const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId: school.id } }, include: { class: true, classTeacher: true } });
  if (!section) notFound();
  const [session, periods, cells, { timetableDays }] = await Promise.all([
    getCurrentSession(school.id),
    getPeriods(school.id),
    loadSectionCells(section.id),
    db.school.findUniqueOrThrow({ where: { id: school.id }, select: { timetableDays: true } }),
  ]);
  const label = sectionLabel(section);

  return (
    <>
      <div className="print:hidden">
        <Breadcrumbs items={[{ label: "Class timetables", href: "/admin/timetable" }, { label, href: `/admin/timetable/class/${section.id}` }, { label: "Print" }]} />
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{school.name} · Session {session.name}</p>
            <h2 className="text-h2 font-semibold text-fg">Timetable · {label}</h2>
            {section.classTeacher && <p className="text-sm text-muted">Class teacher: {fullName(section.classTeacher)}</p>}
          </div>
          <div className="print:hidden">
            <PrintButton />
          </div>
        </div>
        <TimetableGrid days={[...timetableDays].sort()} periods={periods} cells={cells} />
      </Card>
    </>
  );
}
