import Link from "next/link";
import { CalendarOff, PartyPopper, Plane, UserRoundPlus, UserRoundX, Users } from "lucide-react";
import { DayShortcuts } from "@/components/attendance/day-shortcuts";
import { DrillNav } from "@/components/attendance/drill-nav";
import { ProxyAssign } from "@/components/attendance/proxy-assign";
import { Badge, Callout, Card, EmptyState, PagedTable, PageHeader, StatCard, StatGrid, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { attendanceWindow } from "@/lib/attendance";
import { formatISO, isoDate, parseISODate, shortDate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/leave-shared";
import { proxyDay } from "@/lib/proxy";
import { getCurrentSchool } from "@/lib/school";
import { assignProxy, removeProxy } from "./actions";
import { AttendanceTabs } from "../attendance-tabs";

/**
 * Daily leave and proxy roster (?date=, default today): teachers and staff
 * away that day, and for each away teacher the periods to cover with a proxy.
 */
export default async function LeaveProxyPage({ searchParams }: PageProps<"/admin/attendance/proxy">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const min = isoDate(win.session.startDate);
  const max = isoDate(win.session.endDate);
  const raw = typeof params.date === "string" && parseISODate(params.date) ? params.date : win.today;
  const date = raw < min ? min : raw > max ? max : raw;
  const [day, holiday] = await Promise.all([
    proxyDay(school.id, date),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId: school.id, date: parseISODate(date)! } } }),
  ]);
  const teachersAway = day.away.filter((p) => p.kind === "TEACHER");
  const periodsToCover = Object.values(day.toCover).flat().length;

  return (
    <>
      <DrillNav items={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Leave & proxy" }]} />
      <PageHeader title="Leave & proxy" subtitle={`${formatISO(date)}${date === win.today ? " · Today" : ""}`} />
      <AttendanceTabs active="proxy" date={date <= win.max ? date : win.max} />
      <div className="mb-6">
        <DayShortcuts basePath="/admin/attendance/proxy" date={date} today={win.today} min={min} max={max} />
      </div>

      {holiday ? (
        <Callout icon={CalendarOff} className="mb-6">
          <strong className="font-semibold">School holiday: {holiday.name}.</strong> No proxies are needed.
        </Callout>
      ) : (
        !day.schoolDay && (
          <Callout icon={CalendarOff} className="mb-6">
            No timetable on this day of the week, so there are no periods to cover.
          </Callout>
        )
      )}

      <StatGrid>
        <StatCard icon={Users} tone="indigo" label="Staff away" value={day.away.length} detail={`${teachersAway.length} teaching · ${day.away.length - teachersAway.length} non-teaching`} />
        <StatCard icon={Plane} tone="violet" label="On approved leave" value={day.away.filter((p) => p.leave).length} detail="Leave covering this day" />
        <StatCard icon={UserRoundPlus} tone="emerald" label="Periods covered" value={`${day.covered} / ${periodsToCover}`} detail="By proxy teachers" />
        <StatCard icon={UserRoundX} tone="rose" label="Still uncovered" value={holiday ? 0 : day.uncovered} detail={day.uncovered && !holiday ? "Assign a proxy below" : "All covered"} />
      </StatGrid>

      <Card padded={false} className="mt-6" title="Staff away" icon={Plane} description="On approved leave, or marked absent / on leave in staff attendance.">
        {day.away.length === 0 ? (
          <EmptyState icon={PartyPopper} title="Everyone is in" description="No teacher or staff member is on leave or marked absent on this day." />
        ) : (
          <PagedTable
            noun="people"
            pageSize={20}
            theadClassName={theadClass}
            head={
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Employee ID</th>
                <th className={thClass}>Department</th>
                <th className={thClass}>Leave type</th>
                <th className={thClass}>Duration</th>
                <th className={thClass}>Proxy</th>
              </tr>
            }
          >
            {day.away.map((p) => {
              const periods = day.toCover[p.id] ?? [];
              return (
                <tr key={p.id} className={trClass}>
                  <td className={tdClass}>
                    <Link href={p.kind === "TEACHER" ? `/admin/teachers/${p.id}` : `/admin/staff/${p.id}`} className="font-medium text-fg hover:text-accent-text">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-muted">{p.kind === "TEACHER" ? "Teaching" : "Non-teaching"}</span>
                  </td>
                  <td className={`${tdClass} font-mono text-xs`}>{p.code}</td>
                  <td className={`${tdClass} text-sm`}>{p.department}</td>
                  <td className={tdClass}>
                    {p.leave ? (
                      <Badge tone="indigo">{CATEGORY_LABELS[p.leave.category]}</Badge>
                    ) : (
                      <Badge tone="red" dot>
                        {p.marked === "ON_LEAVE" ? "Marked on leave" : "Absent (no leave)"}
                      </Badge>
                    )}
                  </td>
                  <td className={`${tdClass} text-sm`}>
                    {p.leave
                      ? `${p.leave.from === p.leave.to ? formatISO(p.leave.from, shortDate) : `${formatISO(p.leave.from, shortDate)} – ${formatISO(p.leave.to, shortDate)}`} · ${p.leave.days} day${p.leave.days === 1 ? "" : "s"}`
                      : "This day"}
                  </td>
                  <td className={tdClass}>
                    {p.kind === "STAFF" ? (
                      <span className="text-xs text-subtle">—</span>
                    ) : holiday || periods.length === 0 ? (
                      <span className="text-xs text-muted">No periods this day</span>
                    ) : (
                      <ProxyAssign teacherName={p.name} date={date} periods={periods} free={day.free} assign={assignProxy} remove={removeProxy} />
                    )}
                  </td>
                </tr>
              );
            })}
          </PagedTable>
        )}
      </Card>
    </>
  );
}
