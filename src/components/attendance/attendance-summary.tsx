import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { studentAttendanceSummary } from "@/lib/attendance";
import { ATTENDANCE_STATUSES, STATUS_META } from "@/lib/attendance-shared";

/** A student's attendance for the current session: percentage and a count per status. */
export async function AttendanceSummaryCard({
  schoolId,
  studentId,
  registerHref,
}: {
  schoolId: string;
  studentId: string;
  registerHref?: string | null;
}) {
  const { counts, percent, session } = await studentAttendanceSummary(schoolId, studentId);
  const days = ATTENDANCE_STATUSES.reduce((n, s) => n + counts[s], 0);
  const tone = percent == null ? "text-subtle" : percent >= 90 ? "text-success" : percent >= 75 ? "text-warning" : "text-danger";
  const bar = percent == null ? "bg-surface-3" : percent >= 90 ? "bg-success-solid" : percent >= 75 ? "bg-warning-solid" : "bg-danger-solid";
  return (
    <Card
      title="Attendance"
      icon={CalendarCheck}
      description={`Session ${session.name}`}
      action={
        registerHref && (
          <Link href={registerHref} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
            Register
          </Link>
        )
      }
    >
      {days === 0 ? (
        <p className="text-sm text-muted">No attendance marked yet this session.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <p className={`text-display-sm font-semibold tabular-nums ${tone}`}>{percent}%</p>
            <p className="text-xs text-muted">{days} school days</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-5 gap-1 text-center">
            {ATTENDANCE_STATUSES.map((s) => (
              <div key={s} className="rounded-lg bg-surface-2 py-2">
                <dt className={`text-[11px] font-semibold ${STATUS_META[s].text}`} title={STATUS_META[s].label}>
                  {STATUS_META[s].short}
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-fg">{counts[s]}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Card>
  );
}
