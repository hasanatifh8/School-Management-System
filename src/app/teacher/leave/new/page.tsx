import { LeaveForm } from "@/components/leave/leave-form";
import { Card, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { leaveBalance, leavePeople, teacherLeaveActor, upcomingDaysOff } from "@/lib/leave";
import { requireTeacher } from "@/lib/teacher-auth";
import { applyLeave } from "../actions";

export default async function TeacherNewLeavePage() {
  const ctx = await requireTeacher();
  const today = todayISO();
  const [people, balance, daysOff] = await Promise.all([
    leavePeople(teacherLeaveActor(ctx)),
    leaveBalance(ctx.school.id, "TEACHER", ctx.teacher.id),
    upcomingDaysOff(ctx.school.id, today),
  ]);
  return (
    <>
      <PageHeader
        title="Apply for leave"
        subtitle={ctx.classSection ? `For yourself, or for a student of your class${ctx.classSections.length > 1 ? "es" : ""} (for example, from a parent's note).` : undefined}
        breadcrumbs={[{ label: "Leave", href: "/teacher/leave" }, { label: "New request" }]}
      />
      <Card className="max-w-2xl">
        <LeaveForm action={applyLeave} people={people} self="TEACHER" canApproveNow={false} today={today} balance={balance.rows} daysOff={daysOff} />
      </Card>
    </>
  );
}
