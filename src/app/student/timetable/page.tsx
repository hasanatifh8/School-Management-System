import { CalendarClock } from "lucide-react";
import { TimetablePanel } from "@/components/student-profile/panels";
import { StudentBanner } from "@/components/student-portal/ui";
import { sectionLabel } from "@/lib/queries";
import { requireStudent } from "@/lib/student-auth";

/** The student's class timetable for the week; today is highlighted. */
export default async function StudentTimetablePage() {
  const { school, section } = await requireStudent();
  return (
    <>
      <StudentBanner icon={CalendarClock} tone="sky" title="My timetable" subtitle={section ? `${sectionLabel(section)} · every period of the week, today highlighted` : "You haven't been placed in a class yet."} />
      <TimetablePanel schoolId={school.id} sectionId={section?.id ?? null} />
    </>
  );
}
