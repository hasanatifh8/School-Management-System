import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { TimetableEditor } from "@/components/timetable/timetable-editor";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { loadSectionTimetable } from "@/lib/timetable";
import { saveClassTimetable } from "../actions";

/** The class teacher's editor for their own section. */
export default async function EditClassTimetablePage() {
  const ctx = await requireTeacher();
  if (!ctx.classSection) redirect("/teacher/timetable");
  const data = await loadSectionTimetable(ctx.school.id, ctx.classSection.id);
  if (!data || data.section.timetable?.locked) redirect("/teacher/timetable");
  const label = sectionLabel(ctx.classSection);

  return (
    <>
      <PageHeader
        title={`${label} timetable`}
        subtitle="Choose a subject for each period; its teacher is filled in for you."
        breadcrumbs={[{ label: "Timetable", href: "/teacher/timetable" }, { label: "Edit class timetable" }]}
      />
      <Card>
        {data.subjects.length === 0 || !data.periods.some((p) => !p.isBreak) ? (
          <EmptyState icon={CalendarClock} title="Not ready yet" description="Ask the admin to set up the periods and your class's subjects first." />
        ) : (
          <TimetableEditor
            key={data.section.timetable?.updatedAt.toISOString() ?? "new"}
            days={data.days}
            periods={data.periods}
            subjects={data.subjects}
            teachers={data.teachers}
            subjectTeacher={data.subjectTeacher}
            busy={data.busy}
            initial={data.slots}
            action={saveClassTimetable}
          />
        )}
      </Card>
    </>
  );
}
