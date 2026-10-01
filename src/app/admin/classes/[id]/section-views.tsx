// The Timetable and Attendance tabs of a section on the class page. Each works
// on that one section only; the full-school views stay under Timetable and Attendance.
import { Bell, CalendarClock, Lock, LockOpen, Printer, Table2 } from "lucide-react";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { DateNav } from "@/components/attendance/date-nav";
import { ActionForm, SubmitButton } from "@/components/forms";
import { TimetableEditor } from "@/components/timetable/timetable-editor";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { attendanceSheetProps, attendanceWindow, pickDate } from "@/lib/attendance";
import { formatISO, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { loadSectionTimetable } from "@/lib/timetable";
import { clearClassHoliday, saveAttendance, setClassHoliday } from "../../attendance/actions";
import { saveTimetable, setTimetableLock } from "../../timetable/actions";

/** This section's weekly timetable: view, fill in, lock and print. */
export async function SectionTimetable({ schoolId, sectionId }: { schoolId: string; sectionId: string }) {
  const data = await loadSectionTimetable(schoolId, sectionId);
  if (!data) return null;
  const { section } = data;
  const locked = section.timetable?.locked ?? false;
  const label = sectionLabel(section);

  if (!data.periods.some((p) => !p.isBreak)) {
    return (
      <Card>
        <EmptyState
          icon={Bell}
          title="Set up the bell schedule first"
          description="Add the periods of a school day (and breaks) once. Then every section gets a weekly timetable to fill in."
          action={<ButtonLink href="/admin/timetable/periods">Set up periods</ButtonLink>}
        />
      </Card>
    );
  }
  return (
    <Card
      title={`${label} timetable`}
      icon={CalendarClock}
      description={
        section.classTeacher
          ? `Only ${label}. Class teacher: ${fullName(section.classTeacher)}${locked ? " · locked, only admins can change it" : " · can also edit this"}`
          : `Only ${label}. No class teacher assigned.`
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
        <EmptyState compact icon={CalendarClock} title={`No subjects in ${section.class.name}`} description="Add subjects with the Curriculum button above, then fill in the timetable." />
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
  );
}

/** This section's attendance for a day (?date=), with its monthly register one click away. */
export async function SectionAttendance({
  schoolId,
  classId,
  sectionId,
  dateParam,
}: {
  schoolId: string;
  classId: string;
  sectionId: string;
  dateParam: string | string[] | undefined;
}) {
  const win = await attendanceWindow(schoolId);
  const date = pickDate(dateParam, win);
  const base = `/admin/classes/${classId}?section=${sectionId}&view=attendance`;
  const [sheet, section, siblings, markedDays] = await Promise.all([
    attendanceSheetProps(schoolId, sectionId, date),
    db.section.findFirstOrThrow({
      where: { id: sectionId },
      include: { class: true, classTeacher: { select: { firstName: true, middleName: true, lastName: true } } },
    }),
    db.section.findMany({ where: { classId, students: { some: { status: "ACTIVE" } } }, orderBy: { name: "asc" }, include: { class: true } }),
    db.attendanceDay.findMany({ where: { schoolId, date: parseISODate(date)!, section: { classId } }, select: { sectionId: true } }),
  ]);
  // Next section of this class not yet marked on this date (stays inside the class).
  const marked = new Set(markedDays.map((d) => d.sectionId));
  const here = siblings.findIndex((s) => s.id === sectionId);
  const next = sheet.schoolHoliday ? null : [...siblings.slice(here + 1), ...siblings.slice(0, Math.max(here, 0))].find((s) => !marked.has(s.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">
            {sectionLabel(section)} · {formatISO(date)}
          </p>
          <p className="text-xs text-muted">Only this section&apos;s students. Class teacher: {section.classTeacher ? fullName(section.classTeacher) : "none"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateNav basePath={base} date={date} min={win.min} max={win.max} />
          <ButtonLink href={`/admin/attendance/register?section=${sectionId}&period=month&month=${date.slice(0, 7)}`} variant="secondary" size="sm" icon={Table2}>
            Monthly register
          </ButtonLink>
        </div>
      </div>
      <div className="max-w-4xl">
        <AttendanceSheet
          key={`${sectionId}:${date}`}
          {...sheet}
          save={saveAttendance.bind(null, sectionId, date)}
          setHoliday={setClassHoliday.bind(null, sectionId, date)}
          clearHoliday={clearClassHoliday.bind(null, sectionId, date)}
          next={next ? { href: `/admin/classes/${classId}?section=${next.id}&view=attendance&date=${date}`, label: sectionLabel(next) } : null}
        />
      </div>
    </div>
  );
}
