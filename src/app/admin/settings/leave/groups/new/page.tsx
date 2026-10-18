import { Card, PageHeader } from "@/components/ui";
import { getCurrentSchool } from "@/lib/school";
import { saveLeavePolicy } from "@/app/admin/leave/actions";
import { LeaveGroupForm } from "../group-form";
import { loadMembers } from "../members";

export default async function NewLeaveGroupPage() {
  const school = await getCurrentSchool();
  const { members } = await loadMembers(school.id);
  return (
    <>
      <PageHeader
        title="New leave group"
        subtitle="Set the leave days for a group of the school's teachers and staff, then tick who is in it."
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Teacher & staff leave", href: "/admin/settings/leave" },
          { label: "New group" },
        ]}
      />
      <Card className="max-w-4xl">
        <LeaveGroupForm action={saveLeavePolicy.bind(null, null)} name="" days={{}} members={members} selected={[]} groupName={null} />
      </Card>
    </>
  );
}
