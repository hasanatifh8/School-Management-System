import { PersonAttendanceView } from "@/components/attendance/person-attendance";
import { attendanceWindow, getSaturdayOff, loadStudentAttendance, pickMonth } from "@/lib/attendance";
import { ATTENDANCE_STATUSES, STATUS_META } from "@/lib/attendance-shared";

const sinceFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * A student's attendance for the session: totals, a month as a calendar
 * register (?month=) and every month's totals. Used on the student's profile
 * (admin) and in the student portal.
 */
export async function StudentAttendanceSection({
  schoolId,
  student,
  monthHref,
  month: param,
  register,
}: {
  schoolId: string;
  student: { id: string; sectionId: string | null; admissionDate: Date };
  /** Link to a month: `${monthHref}${month}`. */
  monthHref: string;
  month: string | string[] | undefined;
  /** The class register: `${href}${month}`; left out in the student portal. */
  register?: { href: string; label: string };
}) {
  const win = await attendanceWindow(schoolId);
  const month = pickMonth(param, win);
  const data = await loadStudentAttendance(schoolId, student, win.min, win.max);
  const t = data.total;
  const m = data.byMonth.find((x) => x.month === month);
  const red = (n: number) => (n ? "text-danger" : undefined);
  const row = (c: typeof t) => [
    { label: "Present", value: c.PRESENT, cls: "text-success" },
    { label: "Absent", value: c.ABSENT, cls: red(c.ABSENT) },
    { label: "Late", value: c.LATE },
    { label: "Half day", value: c.HALF_DAY },
    { label: "Leave", value: c.LEAVE },
  ];
  return (
    <PersonAttendanceView
      session={win.session.name}
      percent={data.percent}
      subtitle={data.days ? `${data.days} school day${data.days === 1 ? "" : "s"} marked${data.since > win.min ? ` since admission on ${sinceFmt.format(student.admissionDate)}` : ""}` : undefined}
      counts={[{ label: "School days", value: data.days }, ...row(t)]}
      note="Present and late count as a full day, a half day as half; absent and leave count as not attended. Days the class took no attendance are not counted."
      month={month}
      minMonth={win.min.slice(0, 7)}
      maxMonth={win.max.slice(0, 7)}
      today={win.today}
      statuses={ATTENDANCE_STATUSES}
      meta={STATUS_META}
      marks={data.marks}
      remarks={data.remarks}
      holidays={data.holidays}
      onLeave={data.onLeave}
      since={data.since}
      saturdayOff={await getSaturdayOff(schoolId)}
      flagUnmarked={false}
      monthLine={m ? `${m.days} school day${m.days === 1 ? "" : "s"} · present ${m.counts.PRESENT} · absent ${m.counts.ABSENT} · leave ${m.counts.LEAVE}${m.percent != null ? ` · ${m.percent}%` : ""}` : undefined}
      monthRows={data.byMonth.map((x) => ({ month: x.month, percent: x.percent, cells: [{ label: "School days", value: x.days }, ...row(x.counts)] }))}
      monthHref={(mo) => `${monthHref}${mo}`}
      registerHref={register ? `${register.href}${month}` : undefined}
      registerLabel={register?.label}
    />
  );
}
