import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Presentation, Printer, Users } from "lucide-react";
import { ChangeLog } from "@/components/attendance/change-log";
import { DrillNav } from "@/components/attendance/drill-nav";
import { StaffRegisterGrid, StaffRegisterLegend } from "@/components/attendance/staff-register-grid";
import { Card, EmptyState, PageHeader, StatCard, StatGrid, StatusTab, buttonVariants, tabBarClass } from "@/components/ui";
import { attendanceWindow, pickMonth } from "@/lib/attendance";
import { GROUP_LABELS } from "@/lib/attendance-day";
import { addMonths, isoDate, monthName, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { pickStaffGroup } from "@/lib/staff-attendance-shared";
import { loadStaffRegister } from "@/lib/staff-register";
import { editStaffMark } from "../../actions";

const arrow =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 aria-disabled:pointer-events-none aria-disabled:opacity-40";

/**
 * Monthly register for teaching or non-teaching staff (?group=, ?month=):
 * day-by-day marks, Present / Absent / Leave / LOP / %, editing a day with a
 * reason, print, PDF and Excel.
 */
export default async function StaffRegisterPage({ searchParams }: PageProps<"/admin/attendance/staff/register">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const group = pickStaffGroup(params.group);
  const month = pickMonth(params.month, win);
  const reg = await loadStaffRegister(school.id, group, month, win.today);
  const first = parseISODate(`${month}-01`)!;
  const changes = await db.attendanceChange.findMany({
    where: {
      schoolId: school.id,
      date: { gte: first, lte: parseISODate(reg.dates.at(-1)!)! },
      [group === "teaching" ? "teacherId" : "staffId"]: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const href = (m: string, g = group) => `/admin/attendance/staff/register?group=${g}&month=${m}`;
  const prev = month > win.min.slice(0, 7) ? addMonths(month, -1) : null;
  const next = month < win.max.slice(0, 7) ? addMonths(month, 1) : null;
  const lop = reg.rows.reduce((n, r) => n + r.lop, 0);
  const withPct = reg.rows.filter((r) => r.percent != null);
  const avg = withPct.length ? Math.round((withPct.reduce((n, r) => n + r.percent!, 0) / withPct.length) * 10) / 10 : null;
  const label = monthName.format(first);

  return (
    <>
      <DrillNav
        items={[
          { label: "Attendance", href: "/admin/attendance" },
          { label: GROUP_LABELS[group], href: `/admin/attendance/staff?group=${group}` },
          { label: "Monthly register" },
        ]}
      />
      <PageHeader
        title="Staff attendance register"
        subtitle={`${GROUP_LABELS[group]} · ${label} · ${reg.working.length} working day${reg.working.length === 1 ? "" : "s"} so far`}
        action={
          <>
            <a href={`/api/attendance/staff-register?group=${group}&month=${month}`} download className={buttonVariants.secondary}>
              <Download className="h-4 w-4" />
              Excel
            </a>
            <Link href={`/admin/attendance/staff/register/print?group=${group}&month=${month}`} className={buttonVariants.primary}>
              <Printer className="h-4 w-4" />
              Print / PDF
            </Link>
          </>
        }
      />

      <div className="mb-6 border-b border-line">
        <nav aria-label="Group" className={tabBarClass}>
          <StatusTab href={href(month, "teaching")} active={group === "teaching"} label="Teaching staff" icon={Presentation} />
          <StatusTab href={href(month, "non-teaching")} active={group === "non-teaching"} label="Non-teaching staff" icon={Users} />
        </nav>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={prev ? href(prev) : "#"} aria-label="Previous month" aria-disabled={!prev} className={arrow}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="min-w-36 text-center text-sm font-semibold text-fg">{label}</span>
        <Link href={next ? href(next) : "#"} aria-label="Next month" aria-disabled={!next} className={arrow}>
          <ChevronRight className="h-4 w-4" />
        </Link>
        {month !== win.today.slice(0, 7) && (
          <Link href={href(win.today.slice(0, 7))} className="ml-1 text-sm font-medium text-accent-text underline-offset-4 hover:underline">
            This month
          </Link>
        )}
      </div>

      <StatGrid>
        <StatCard icon={Users} tone="indigo" label="People" value={reg.rows.length} detail={GROUP_LABELS[group]} />
        <StatCard tone="emerald" label="Average attendance" value={avg == null ? "—" : `${avg}%`} detail="Approved leave not counted" />
        <StatCard tone="violet" label="Approved leave" value={reg.rows.reduce((n, r) => n + r.leave, 0)} detail="Person-days this month" />
        <StatCard tone="amber" label="Loss of pay" value={lop % 1 ? lop.toFixed(1) : lop} detail="Absent days + half days ÷ 2" />
      </StatGrid>

      <Card padded={false} className="mt-6" title="Day by day" description="Click a day to change it. A reason is required and kept in the change log.">
        {reg.rows.length === 0 ? (
          <EmptyState icon={Users} title={`No ${GROUP_LABELS[group].toLowerCase()} yet`} />
        ) : (
          <StaffRegisterGrid
            group={group}
            dates={reg.dates}
            today={win.today}
            holidays={Object.fromEntries(reg.holidays)}
            rows={reg.rows}
            edit={editStaffMark}
          />
        )}
        <div className="border-t border-line px-4 py-3 sm:px-6">
          <StaffRegisterLegend />
        </div>
      </Card>

      <div className="mt-6 max-w-3xl">
        <ChangeLog
          description={`${GROUP_LABELS[group]} · ${label}`}
          changes={changes.map((c) => ({ ...c, date: isoDate(c.date) }))}
        />
      </div>
    </>
  );
}
