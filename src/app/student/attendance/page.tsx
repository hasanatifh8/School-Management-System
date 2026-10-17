import { StudentAttendanceSection } from "@/components/attendance/student-attendance-section";
import { PageHeader } from "@/components/ui";
import { requireStudent } from "@/lib/student-auth";

/** The student's own attendance for the session: totals, a calendar per month and every month's totals. */
export default async function StudentAttendancePage({ searchParams }: PageProps<"/student/attendance">) {
  const { month } = await searchParams;
  const { student, school } = await requireStudent();
  return (
    <>
      <PageHeader title="My attendance" subtitle="Your attendance this session, as marked by your class teacher." />
      <StudentAttendanceSection schoolId={school.id} student={student} monthHref="/student/attendance?month=" month={month} />
    </>
  );
}
