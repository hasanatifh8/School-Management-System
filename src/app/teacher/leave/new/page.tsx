import { LeaveForm } from "@/components/leave/leave-form";
import { Card, PageHeader } from "@/components/ui";
import { addMonths, isoDate, todayISO } from "@/lib/attendance-shared";
import { leaveBalance, leavePeople, loadLeaveRules, monthUsage, teacherLeaveActor, upcomingDaysOff } from "@/lib/leave";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";
import { applyLeave } from "../actions";

export default async function TeacherNewLeavePage() {
  const ctx = await requireTeacher();
  const today = todayISO();
  const session = await getCurrentSession(ctx.school.id);
  const lastMonth = [isoDate(session.endDate).slice(0, 7), addMonths(today.slice(0, 7), 6)].sort()[1];
  const [people, balance, daysOff, rules, usage] = await Promise.all([
    leavePeople(teacherLeaveActor(ctx)),
    leaveBalance(ctx.school.id, "TEACHER", ctx.teacher.id),
    upcomingDaysOff(ctx.school.id, today),
    loadLeaveRules(ctx.school.id),
    // This month's (and later months') leave, for the monthly limit; last month too for back-dated leave.
    monthUsage(ctx.school.id, "TEACHER", ctx.teacher.id, addMonths(today.slice(0, 7), -1), lastMonth),
  ]);
  return (
    <>
      <PageHeader
        title="Apply for leave"
        subtitle={ctx.classSection ? `For yourself, or for a student of your class${ctx.classSections.length > 1 ? "es" : ""} (for example, from a parent's note).` : undefined}
        breadcrumbs={[{ label: "Leave", href: "/teacher/leave" }, { label: "New request" }]}
      />
      <Card className="max-w-2xl">
        <LeaveForm
          action={applyLeave}
          people={people}
          self="TEACHER"
          canApproveNow={false}
          today={today}
          balance={balance.rows}
          daysOff={daysOff}
          proof={rules.proof}
          monthlyCaps={rules.monthly.TEACHER}
          usage={usage}
        />
      </Card>
    </>
  );
}
