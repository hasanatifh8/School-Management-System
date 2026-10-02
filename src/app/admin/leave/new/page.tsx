import { LeaveForm } from "@/components/leave/leave-form";
import { Card, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { leavePeople } from "@/lib/leave";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { createLeave } from "../actions";

export default async function NewLeavePage() {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  const people = await leavePeople({ kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" });
  return (
    <>
      <PageHeader title="New leave request" breadcrumbs={[{ label: "Leave", href: "/admin/leave" }, { label: "New request" }]} />
      <Card className="max-w-2xl">
        <LeaveForm action={createLeave} people={people} canApproveNow today={todayISO()} />
      </Card>
    </>
  );
}
