import { CalendarCheck, Table2 } from "lucide-react";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { DateNav } from "@/components/attendance/date-nav";
import { UpcomingHolidays } from "@/components/attendance/upcoming-holidays";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { attendanceSheetProps, attendanceWindow, pickDate } from "@/lib/attendance";
import { formatISO } from "@/lib/attendance-shared";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { clearClassHoliday, saveAttendance, setClassHoliday } from "../../admin/attendance/actions";

export default async function TeacherAttendancePage({ searchParams }: PageProps<"/teacher/attendance">) {
  const ctx = await requireTeacher();
  if (!ctx.classSection) {
    return (
      <>
        <PageHeader title="Attendance" />
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="Only class teachers take attendance"
            description="You'll be able to take attendance here once the school admin makes you a class teacher."
          />
        </Card>
      </>
    );
  }
  const section = ctx.classSection;
  const win = await attendanceWindow(ctx.school.id);
  const date = pickDate((await searchParams).date, win);
  const sheet = await attendanceSheetProps(ctx.school.id, section.id, date);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${sectionLabel(section)} · ${formatISO(date)}`}
        action={
          <ButtonLink href="/teacher/attendance/register" variant="secondary" icon={Table2}>
            Monthly register
          </ButtonLink>
        }
      />
      <div className="mb-6">
        <DateNav basePath="/teacher/attendance" date={date} min={win.min} max={win.max} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <AttendanceSheet
          key={date}
          {...sheet}
          save={saveAttendance.bind(null, section.id, date)}
          setHoliday={setClassHoliday.bind(null, section.id, date)}
          clearHoliday={clearClassHoliday.bind(null, section.id, date)}
        />
        <div className="self-start">
          <UpcomingHolidays schoolId={ctx.school.id} from={win.today} />
        </div>
      </div>
    </>
  );
}
