import Link from "next/link";
import { GraduationCap, Plane, Presentation, SearchX, Users } from "lucide-react";
import { DateNav } from "@/components/attendance/date-nav";
import { DayKpis, rosterHref } from "@/components/attendance/day-kpis";
import { DrillNav } from "@/components/attendance/drill-nav";
import { ListToolbar, SearchBox } from "@/components/list-toolbar";
import { Badge, Card, EmptyState, PagedTable, PageHeader, PersonCell, StatusTab, tabBarClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { attendanceWindow, pickDate } from "@/lib/attendance";
import {
  FILTER_LABELS,
  GROUP_LABELS,
  ROSTER_FILTERS,
  dayRoster,
  filterRoster,
  pickRosterFilter,
  pickRosterGroup,
  type DayMark,
} from "@/lib/attendance-day";
import { formatISO, shortDate } from "@/lib/attendance-shared";
import { CATEGORY_LABELS } from "@/lib/leave-shared";
import { getCurrentSchool } from "@/lib/school";

const MARKS: Record<DayMark, { label: string; tone: "green" | "red" | "amber" | "sky" | "indigo" }> = {
  PRESENT: { label: "Present", tone: "green" },
  ABSENT: { label: "Absent", tone: "red" },
  LATE: { label: "Late", tone: "amber" },
  HALF_DAY: { label: "Half day", tone: "sky" },
  LEAVE: { label: "Leave", tone: "indigo" },
};

const GROUP_ICONS = { students: GraduationCap, teaching: Presentation, "non-teaching": Users } as const;

/**
 * Drill-down from an attendance KPI card: everyone in a group (students,
 * teaching or non-teaching staff) in one bucket (present, absent, on leave,
 * late, not marked) on a date. ?group=, ?status=, ?date=, ?q=.
 */
export default async function AttendanceRosterPage({ searchParams }: PageProps<"/admin/attendance/list">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const date = pickDate(params.date, win);
  const group = pickRosterGroup(params.group);
  const status = pickRosterFilter(params.status);
  const q = typeof params.q === "string" ? params.q : "";
  const roster = await dayRoster(school.id, group, date);
  const rows = filterRoster(roster.people, status, q);
  const isToday = date === win.today;
  const title = status ? `${FILTER_LABELS[status]}${isToday && status !== "late" ? " today" : ""}` : "Everyone";
  const keep = (s: string | null) => `${rosterHref(group, pickRosterFilter(s), date)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const groupHome = group === "students" ? `/admin/attendance?date=${date}` : `/admin/attendance/staff?group=${group}&date=${date}`;

  return (
    <>
      <DrillNav
        items={[
          { label: "Attendance", href: `/admin/attendance?date=${date}` },
          { label: GROUP_LABELS[group], href: rosterHref(group, null, date) },
          { label: title },
        ]}
      />
      <PageHeader title={`${GROUP_LABELS[group]} · ${title}`} subtitle={`${formatISO(date)} · ${rows.length} ${rows.length === 1 ? "person" : "people"}`} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <DateNav basePath={rosterHref(group, status, date).replace(/&date=[^&]*/, "")} date={date} min={win.min} max={win.max} />
        <Link href={groupHome} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
          {group === "students" ? "Take attendance" : "Mark staff attendance"}
        </Link>
      </div>

      <div className="mb-6 border-b border-line">
        <nav aria-label="Group" className={tabBarClass}>
          {(["students", "teaching", "non-teaching"] as const).map((g) => (
            <StatusTab key={g} href={rosterHref(g, status, date)} active={g === group} label={GROUP_LABELS[g]} icon={GROUP_ICONS[g]} />
          ))}
        </nav>
      </div>

      <DayKpis group={group} date={date} roster={roster} active={status} today={isToday} />

      <Card padded={false} className="mt-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick filters">
            {[null, ...ROSTER_FILTERS].map((f) => (
              <Link
                key={f ?? "all"}
                href={keep(f)}
                aria-current={status === f ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${status === f ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
              >
                {f ? FILTER_LABELS[f] : "Everyone"} <span className="tabular-nums opacity-70">{f ? roster.counts[f] : roster.total}</span>
              </Link>
            ))}
          </div>
          <div className="ml-auto w-full sm:w-72">
            <ListToolbar>
              <SearchBox placeholder={group === "students" ? "Search name, ID or class" : "Search name, ID or department"} />
            </ListToolbar>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={q ? SearchX : status === "leave" ? Plane : Users}
            title={q ? "No one matches your search" : `No one ${status ? FILTER_LABELS[status].toLowerCase() : "here"}`}
            description={roster.marked ? undefined : "Attendance for this day hasn't been marked yet."}
          />
        ) : (
          <PagedTable
            noun="people"
            pageSize={25}
            theadClassName={theadClass}
            head={
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>ID</th>
                <th className={thClass}>{group === "students" ? "Class" : "Department"}</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Note</th>
              </tr>
            }
          >
            {rows.map((p) => (
              <tr key={p.id} className={trClass}>
                <td className={tdClass}>
                  <PersonCell name={p.name} photoUrl={p.photoUrl} href={p.href} size="sm" sub={group === "students" ? undefined : p.sub} />
                </td>
                <td className={`${tdClass} font-mono text-xs`}>{p.code}</td>
                <td className={`${tdClass} text-sm`}>{group === "students" ? p.sub : p.department}</td>
                <td className={tdClass}>
                  <div className="flex flex-wrap gap-1">
                    {p.mark ? (
                      <Badge tone={MARKS[p.mark].tone} dot>
                        {MARKS[p.mark].label}
                      </Badge>
                    ) : (
                      <Badge>Not marked</Badge>
                    )}
                    {p.leave && p.mark !== "LEAVE" && <Badge tone="indigo">On leave</Badge>}
                  </div>
                </td>
                <td className={`${tdClass} text-xs text-muted`}>
                  {p.leave
                    ? `${CATEGORY_LABELS[p.leave.category]} · ${p.leave.from === p.leave.to ? formatISO(p.leave.from, shortDate) : `${formatISO(p.leave.from, shortDate)} – ${formatISO(p.leave.to, shortDate)}`}`
                    : (p.remark ?? "")}
                </td>
              </tr>
            ))}
          </PagedTable>
        )}
      </Card>
    </>
  );
}
