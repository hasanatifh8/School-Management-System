import { StudentAttendanceSection } from "@/components/attendance/student-attendance-section";
import { CalendarCheck } from "lucide-react";
import { StudentBanner } from "@/components/student-portal/ui";
import { requireStudent } from "@/lib/student-auth";

/** The student's own attendance for the session: totals, a calendar per month and every month's totals. */
export default async function StudentAttendancePage({ searchParams }: PageProps<"/student/attendance">) {
  const { month } = await searchParams;
  const { student, school } = await requireStudent();
  return (
    <>
      <StudentBanner icon={CalendarCheck} tone="emerald" title="My attendance" subtitle="Every school day this session, as marked by your class teacher. Tap a month to see its calendar." />
      <StudentAttendanceSection schoolId={school.id} student={student} monthHref="/student/attendance?month=" month={month} />
    </>
  );
}
