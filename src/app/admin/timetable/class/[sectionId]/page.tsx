import { notFound } from "next/navigation";
import { CalendarClock, Lock, LockOpen, Printer } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { TimetableEditor } from "@/components/timetable/timetable-editor";
import { Breadcrumbs, ButtonLink, Card, EmptyState } from "@/components/ui";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { loadSectionTimetable } from "@/lib/timetable";
import { saveTimetable, setTimetableLock } from "../../actions";

/** Admin editor for one section's weekly timetable. */
export default async function ClassTimetablePage({ params }: PageProps<"/admin/timetable/class/[sectionId]">) {
  const { sectionId } = await params;
  const school = await getCurrentSchool();
  const data = await loadSectionTimetable(school.id, sectionId);
  if (!data) notFound();
  const { section } = data;
  const locked = section.timetable?.locked ?? false;
  const label = sectionLabel(section);

  return (
    <>
      <Breadcrumbs items={[{ label: "Class timetables", href: "/admin/timetable" }, { label }]} />
      <Card
        title={`${label} timetable`}
        icon={CalendarClock}
        description={
          section.classTeacher
            ? `Class teacher: ${fullName(section.classTeacher)}${locked ? " · locked, only admins can change it" : " · can also edit this"}`
            : "No class teacher assigned"
        }
        action={
          <div className="flex items-center gap-2">
            <ButtonLink href={`/admin/timetable/class/${section.id}/print`} variant="ghost" size="sm" icon={Printer}>
              Print
            </ButtonLink>
            <ActionForm action={setTimetableLock.bind(null, section.id, !locked)} compact className="flex flex-row-reverse items-center gap-2">
              <SubmitButton variant="secondary" size="sm" icon={locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}>
                {locked ? "Unlock" : "Lock"}
              </SubmitButton>
            </ActionForm>
          </div>
        }
      >
        {data.subjects.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarClock}
            title={`No subjects in ${section.class.name}`}
            description="Add the class's subjects first, then fill in the timetable."
            action={<ButtonLink href={`/admin/classes/${section.classId}`}>Open class</ButtonLink>}
          />
        ) : (
          <TimetableEditor
            key={section.timetable?.updatedAt.toISOString() ?? "new"}
            days={data.days}
            periods={data.periods}
            subjects={data.subjects}
            teachers={data.teachers}
            subjectTeacher={data.subjectTeacher}
            busy={data.busy}
            initial={data.slots}
            action={saveTimetable.bind(null, section.id)}
          />
        )}
      </Card>
    </>
  );
}
