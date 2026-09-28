import { CalendarClock, Lock, Pencil } from "lucide-react";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { getPeriods, loadSectionCells, loadTeacherTimetable } from "@/lib/timetable";

/** The teacher's own week, and their class's timetable if they are a class teacher. */
export default async function TeacherTimetablePage() {
  const ctx = await requireTeacher();
  const [mine, periods, classCells, classTimetable] = await Promise.all([
    loadTeacherTimetable(ctx.school.id, ctx.teacher.id),
    getPeriods(ctx.school.id),
    ctx.classSection ? loadSectionCells(ctx.classSection.id) : null,
    ctx.classSection ? db.timetable.findUnique({ where: { sectionId: ctx.classSection.id } }) : null,
  ]);
  const weekday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getDay() || 7;

  if (!periods.some((p) => !p.isBreak)) {
    return (
      <>
        <PageHeader title="Timetable" />
        <Card>
          <EmptyState icon={CalendarClock} title="No timetable yet" description="The school hasn't set up its periods yet. Check back later." />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Timetable" subtitle="Your periods this week. Today is highlighted." />
      <div className="space-y-6">
        <Card title="My week" icon={CalendarClock} description={`${mine.count} period(s) a week`}>
          <TimetableGrid days={mine.days} periods={mine.periods} cells={mine.cells} today={weekday} />
        </Card>

        {ctx.classSection && classCells && (
          <Card
            title={`${sectionLabel(ctx.classSection)} timetable`}
            icon={CalendarClock}
            description={classTimetable?.locked ? "Locked by the admin" : "You're the class teacher, so you can edit it."}
            action={
              classTimetable?.locked ? (
                <span className="inline-flex items-center gap-1 text-sm text-muted">
                  <Lock className="h-4 w-4" /> Locked
                </span>
              ) : (
                <ButtonLink href="/teacher/timetable/class" variant="secondary" size="sm" icon={Pencil}>
                  Edit
                </ButtonLink>
              )
            }
          >
            <TimetableGrid days={mine.days} periods={periods} cells={classCells} today={weekday} />
          </Card>
        )}
      </div>
    </>
  );
}
