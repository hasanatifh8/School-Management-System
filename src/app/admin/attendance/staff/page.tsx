import { Briefcase, Presentation, Users } from "lucide-react";
import { StaffAttendanceSheet } from "@/components/attendance/staff-attendance-sheet";
import { DateNav } from "@/components/attendance/date-nav";
import { ButtonLink, Callout, Card, EmptyState, PageHeader, StatusTab } from "@/components/ui";
import { attendanceWindow, pickDate } from "@/lib/attendance";
import { formatISO, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { loadStaffSheet, staffDaySummary } from "@/lib/staff-attendance";
import { pickStaffGroup } from "@/lib/staff-attendance-shared";
import { saveStaffAttendance } from "../actions";
import { AttendanceTabs } from "../attendance-tabs";

/** Teaching and non-teaching staff attendance for one day. */
export default async function StaffAttendancePage({ searchParams }: PageProps<"/admin/attendance/staff">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const date = pickDate(params.date, win);
  const group = pickStaffGroup(params.group);
  const [sheet, summary, holiday] = await Promise.all([
    loadStaffSheet(school.id, group, date),
    staffDaySummary(school.id, date),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId: school.id, date: parseISODate(date)! } } }),
  ]);
  const tab = (g: string) => `/admin/attendance/staff?group=${g}&date=${date}`;
  const line = (s: typeof summary.teaching) => (s.marked ? `${s.present} of ${s.total} present${s.absent ? ` · ${s.absent} absent` : ""}` : `${s.total} · not marked`);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${formatISO(date)} · Session ${win.session.name}`}
        action={
          <ButtonLink href="/admin/leave" variant="secondary">
            Leave requests
          </ButtonLink>
        }
      />
      <AttendanceTabs active="staff" date={date} />
      <div className="mb-6">
        <DateNav basePath={`/admin/attendance/staff?group=${group}`} date={date} min={win.min} max={win.max} />
      </div>
      {holiday && (
        <Callout icon={Briefcase} className="mb-6">
          <strong className="font-semibold">School holiday: {holiday.name}.</strong> You can still mark staff who came in.
        </Callout>
      )}
      <Card padded={false} className="max-w-4xl">
        <div className="flex gap-6 overflow-x-auto border-b border-line px-4 pt-4 text-sm font-medium sm:px-6">
          <StatusTab href={tab("teaching")} active={group === "teaching"} label={`Teaching · ${line(summary.teaching)}`} icon={Presentation} />
          <StatusTab href={tab("non-teaching")} active={group === "non-teaching"} label={`Non-teaching · ${line(summary.nonTeaching)}`} icon={Users} />
        </div>
        <div className="p-4 sm:p-6">
          {sheet.people.length === 0 ? (
            <EmptyState
              compact
              icon={Users}
              title={group === "teaching" ? "No teachers yet" : "No non-teaching staff yet"}
              action={<ButtonLink href={group === "teaching" ? "/admin/teachers/new" : "/admin/staff/new"}>Add {group === "teaching" ? "a teacher" : "staff"}</ButtonLink>}
            />
          ) : (
            <StaffAttendanceSheet key={`${group}:${date}`} {...sheet} save={saveStaffAttendance.bind(null, group, date)} />
          )}
        </div>
      </Card>
    </>
  );
}
