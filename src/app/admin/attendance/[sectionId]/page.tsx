import { notFound } from "next/navigation";
import { Table2 } from "lucide-react";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { DateNav } from "@/components/attendance/date-nav";
import { ButtonLink, PageHeader } from "@/components/ui";
import { attendanceSheetProps, attendanceWindow, pickDate } from "@/lib/attendance";
import { formatISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { clearClassHoliday, saveAttendance, setClassHoliday } from "../actions";

export default async function SectionAttendancePage({ params, searchParams }: PageProps<"/admin/attendance/[sectionId]">) {
  const { sectionId } = await params;
  const school = await getCurrentSchool();
  const section = await db.section.findFirst({
    where: { id: sectionId, class: { schoolId: school.id } },
    include: { class: true, classTeacher: { select: { firstName: true, middleName: true, lastName: true } } },
  });
  if (!section) notFound();
  const win = await attendanceWindow(school.id);
  const date = pickDate((await searchParams).date, win);
  const sheet = await attendanceSheetProps(school.id, section.id, date);

  return (
    <>
      <PageHeader
        title={sectionLabel(section)}
        breadcrumbs={[{ label: "Attendance", href: `/admin/attendance?date=${date}` }, { label: sectionLabel(section) }]}
        subtitle={`${formatISO(date)} · Class teacher: ${section.classTeacher ? fullName(section.classTeacher) : "none"}`}
        action={
          <ButtonLink href={`/admin/attendance/${section.id}/register?month=${date.slice(0, 7)}`} variant="secondary" icon={Table2}>
            Monthly register
          </ButtonLink>
        }
      />
      <div className="mb-6">
        <DateNav basePath={`/admin/attendance/${section.id}`} date={date} min={win.min} max={win.max} />
      </div>
      <div className="max-w-4xl">
        <AttendanceSheet
          key={date}
          {...sheet}
          save={saveAttendance.bind(null, section.id, date)}
          setHoliday={setClassHoliday.bind(null, section.id, date)}
          clearHoliday={clearClassHoliday.bind(null, section.id, date)}
        />
      </div>
    </>
  );
}
