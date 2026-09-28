import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { Breadcrumbs, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { fullName } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { loadTeacherTimetable } from "@/lib/timetable";

/** One teacher's week across all their classes. */
export default async function TeacherTimetablePage({ params }: PageProps<"/admin/timetable/teachers/[id]">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const teacher = await db.teacher.findFirst({ where: { id, schoolId: school.id } });
  if (!teacher) notFound();
  const t = await loadTeacherTimetable(school.id, teacher.id);
  const name = fullName(teacher);
  return (
    <>
      <Breadcrumbs items={[{ label: "Teacher timetables", href: "/admin/timetable/teachers" }, { label: name }]} />
      <Card title={name} icon={CalendarClock} description={`${t.count} period(s) a week`}>
        <TimetableGrid days={t.days} periods={t.periods} cells={t.cells} />
      </Card>
    </>
  );
}
