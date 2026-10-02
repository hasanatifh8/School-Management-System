import { LeaveForm } from "@/components/leave/leave-form";
import { Card, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { leavePeople, teacherLeaveActor } from "@/lib/leave";
import { requireTeacher } from "@/lib/teacher-auth";
import { applyLeave } from "../actions";

export default async function TeacherNewLeavePage() {
  const ctx = await requireTeacher();
  const people = await leavePeople(teacherLeaveActor(ctx));
  return (
    <>
      <PageHeader
        title="Apply for leave"
        subtitle={ctx.classSection ? "For yourself, or for a student of your class (for example, from a parent's note)." : undefined}
        breadcrumbs={[{ label: "Leave", href: "/teacher/leave" }, { label: "New request" }]}
      />
      <Card className="max-w-2xl">
        <LeaveForm action={applyLeave} people={people} self="TEACHER" canApproveNow={false} today={todayISO()} />
      </Card>
    </>
  );
}
