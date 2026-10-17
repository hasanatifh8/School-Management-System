import { PersonAttendanceView, num } from "@/components/attendance/person-attendance";
import { attendanceWindow, getSaturdayOff, pickMonth } from "@/lib/attendance";
import { parseISODate } from "@/lib/attendance-shared";
import { STAFF_STATUSES, STAFF_STATUS_META } from "@/lib/staff-attendance-shared";
import { loadPersonAttendance } from "@/lib/staff-register";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * A teacher's or staff member's attendance for the session: totals, a month as
 * a calendar register (?month=) and every month's totals. Used on their profile
 * (admin) and in the teacher portal's My attendance.
 */
export async function StaffAttendanceSection({
  schoolId,
  person,
  joined,
  monthHref,
  month: param,
  register,
}: {
  schoolId: string;
  person: { teacherId: string } | { staffId: string };
  /** Joining date (YYYY-MM-DD): days before it aren't counted. */
  joined: string | null;
  /** Link to a month: `${monthHref}${month}`. */
  monthHref: string;
  month: string | string[] | undefined;
  /** A link to the whole staff register: `${href}${month}`; left out in the teacher portal. */
  register?: { href: string; label: string };
}) {
  const win = await attendanceWindow(schoolId);
  const month = pickMonth(param, win);
  const data = await loadPersonAttendance(schoolId, person, win.min, win.max, win.today, joined);
  const t = data.total;
  const m = data.byMonth.find((x) => x.month === month);
  const red = (n: number) => (n ? "text-danger" : undefined);
  return (
    <PersonAttendanceView
      session={win.session.name}
      percent={data.working.length ? t.percent : null}
      subtitle={data.working.length ? `${data.working.length} working day${data.working.length === 1 ? "" : "s"} since ${shortDate.format(parseISODate(data.since)!)}` : undefined}
      aside={t.unmarked ? `${t.unmarked} working day${t.unmarked === 1 ? "" : "s"} not marked` : undefined}
      counts={[
        { label: "Present", value: t.present, cls: "text-success" },
        { label: "Absent", value: t.absent, cls: red(t.absent) },
        { label: "Late", value: t.late },
        { label: "Half day", value: t.halfDay },
        { label: "Leave", value: t.leave },
        { label: "Loss of pay", value: t.lop, cls: red(t.lop) },
      ]}
      note="Approved leave is not counted against attendance. Loss of pay = absent days plus half of each half day."
      month={month}
      minMonth={win.min.slice(0, 7)}
      maxMonth={win.max.slice(0, 7)}
      today={win.today}
      statuses={STAFF_STATUSES}
      meta={STAFF_STATUS_META}
      marks={data.marks}
      remarks={data.remarks}
      holidays={data.holidays}
      onLeave={data.onLeave}
      since={data.since}
      saturdayOff={await getSaturdayOff(schoolId)}
      flagUnmarked
      monthLine={m ? `${m.workingDays} working day${m.workingDays === 1 ? "" : "s"} · present ${num(m.present)} · absent ${m.absent} · leave ${m.leave}${m.percent != null ? ` · ${m.percent}%` : ""}` : undefined}
      monthRows={data.byMonth
        .filter((x) => x.workingDays > 0)
        .map((x) => ({
          month: x.month,
          percent: x.percent,
          cells: [
            { label: "Working days", value: x.workingDays },
            { label: "Present", value: x.present },
            { label: "Absent", value: x.absent, cls: red(x.absent) },
            { label: "Late", value: x.late },
            { label: "Half day", value: x.halfDay },
            { label: "Leave", value: x.leave },
            { label: "Loss of pay", value: x.lop, cls: red(x.lop) },
          ],
        }))}
      monthHref={(mo) => `${monthHref}${mo}`}
      registerHref={register ? `${register.href}${month}` : undefined}
      registerLabel={register?.label}
    />
  );
}
