import { notFound } from "next/navigation";
import { Table2 } from "lucide-react";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { DateNav } from "@/components/attendance/date-nav";
import { ButtonLink, PageHeader } from "@/components/ui";
import { attendanceSheetProps, attendanceWindow, pickDate } from "@/lib/attendance";
import { formatISO, parseISODate } from "@/lib/attendance-shared";
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
  const [sheet, sections, markedDays] = await Promise.all([
    attendanceSheetProps(school.id, section.id, date),
    db.section.findMany({
      where: { class: { schoolId: school.id }, students: { some: { status: "ACTIVE" } } },
      orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
      include: { class: true },
    }),
    db.attendanceDay.findMany({ where: { schoolId: school.id, date: parseISODate(date)! }, select: { sectionId: true } }),
  ]);
  // The next class (after this one, wrapping round) that hasn't been marked on this date.
  const marked = new Set(markedDays.map((d) => d.sectionId));
  const here = sections.findIndex((s) => s.id === section.id);
  const ordered = [...sections.slice(here + 1), ...sections.slice(0, Math.max(here, 0))];
  const nextSection = sheet.schoolHoliday ? null : ordered.find((s) => !marked.has(s.id));

  return (
    <>
      <PageHeader
        title={sectionLabel(section)}
        breadcrumbs={[{ label: "Attendance", href: `/admin/attendance?date=${date}` }, { label: sectionLabel(section) }]}
        subtitle={`${formatISO(date)} · Class teacher: ${section.classTeacher ? fullName(section.classTeacher) : "none"}`}
        action={
          <ButtonLink href={`/admin/attendance/register?section=${section.id}&period=month&month=${date.slice(0, 7)}`} variant="secondary" icon={Table2}>
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
          next={nextSection ? { href: `/admin/attendance/${nextSection.id}?date=${date}`, label: sectionLabel(nextSection) } : null}
        />
      </div>
    </>
  );
}
