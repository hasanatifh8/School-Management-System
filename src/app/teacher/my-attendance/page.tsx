import { CalendarCheck2, CalendarRange, CircleMinus, Plane } from "lucide-react";
import { StaffAttendanceSection } from "@/components/attendance/staff-attendance-section";
import { num } from "@/components/attendance/person-attendance";
import { Card, PageHeader, StatCard, StatGrid } from "@/components/ui";
import { attendanceWindow } from "@/lib/attendance";
import { leaveBalance } from "@/lib/leave";
import { CATEGORY_LABELS } from "@/lib/leave-shared";
import { loadPersonAttendance } from "@/lib/staff-register";
import { requireTeacher } from "@/lib/teacher-auth";

/** The teacher's own attendance for the whole session: totals, a calendar per month and leave left. */
export default async function MyAttendancePage({ searchParams }: PageProps<"/teacher/my-attendance">) {
  const { month } = await searchParams;
  const { teacher, school } = await requireTeacher();
  const joined = teacher.joiningDate ? teacher.joiningDate.toISOString().slice(0, 10) : null;
  const win = await attendanceWindow(school.id);
  const [data, balance] = await Promise.all([
    loadPersonAttendance(school.id, { teacherId: teacher.id }, win.min, win.max, win.today, joined),
    leaveBalance(school.id, "TEACHER", teacher.id),
  ]);
  const t = data.total;
  const thisMonth = data.byMonth.find((m) => m.month === win.today.slice(0, 7));
  const limited = balance.rows.filter((r) => r.allowed != null);
  const allowed = limited.reduce((n, r) => n + (r.allowed ?? 0), 0);
  const used = balance.rows.reduce((n, r) => n + r.used, 0);

  return (
    <>
      <PageHeader title="My attendance" subtitle={`Your attendance and leave for session ${win.session.name}, as marked by the school.`} />

      <div className="mb-6">
        <StatGrid>
          <StatCard
            icon={CalendarCheck2}
            tone={t.percent == null ? "slate" : t.percent >= 90 ? "emerald" : t.percent >= 75 ? "amber" : "rose"}
            label="Session attendance"
            value={t.percent == null ? "—" : `${t.percent}%`}
            detail={data.working.length ? `${num(t.present)} of ${data.working.length} working days present` : "Nothing marked yet"}
          />
          <StatCard
            icon={CalendarRange}
            tone="indigo"
            label="This month"
            value={thisMonth?.percent == null ? "—" : `${thisMonth.percent}%`}
            detail={thisMonth ? `${num(thisMonth.present)} present · ${thisMonth.absent} absent` : "No working days yet"}
          />
          <StatCard
            icon={Plane}
            tone="violet"
            label="Leave taken"
            value={used}
            suffix={allowed ? ` / ${allowed}` : undefined}
            detail={allowed ? `${Math.max(0, allowed - used)} day${allowed - used === 1 ? "" : "s"} left this session` : "Approved leave days"}
          />
          <StatCard
            icon={CircleMinus}
            tone={t.lop ? "rose" : "emerald"}
            label="Loss of pay"
            value={num(t.lop)}
            detail={t.lop ? "Absent days + half of half days" : "No unpaid days"}
          />
        </StatGrid>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <StaffAttendanceSection schoolId={school.id} person={{ teacherId: teacher.id }} joined={joined} monthHref="/teacher/my-attendance?month=" month={month} />

        <Card title="Leave balance" icon={Plane} description={`Session ${balance.session}`} padded={false} className="xl:sticky xl:top-6">
          <ul className="divide-y divide-line">
            {balance.rows.map((r) => {
              const left = r.allowed == null ? null : Math.max(0, r.allowed - r.used);
              const pct = r.allowed ? Math.min(100, Math.round((r.used / r.allowed) * 100)) : 0;
              return (
                <li key={r.category} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">{CATEGORY_LABELS[r.category]}</span>
                    <span className="tabular-nums text-muted">
                      {r.allowed == null ? (
                        `${r.used} used`
                      ) : (
                        <>
                          <span className={left ? "font-semibold text-fg" : "font-semibold text-danger"}>{left}</span> of {r.allowed} left
                        </>
                      )}
                    </span>
                  </div>
                  {r.allowed != null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className={`h-full rounded-full ${pct >= 100 ? "bg-danger-solid" : pct >= 75 ? "bg-warning-solid" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {r.pending > 0 && <p className="mt-1 text-xs text-warning">{r.pending} day{r.pending === 1 ? "" : "s"} waiting for approval</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
