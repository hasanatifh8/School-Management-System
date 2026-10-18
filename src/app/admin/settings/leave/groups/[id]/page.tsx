import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { policyDays } from "@/lib/leave";
import { getCurrentSchool } from "@/lib/school";
import { deleteLeavePolicy, saveLeavePolicy } from "@/app/admin/leave/actions";
import { LeaveGroupForm } from "../group-form";
import { loadMembers } from "../members";

export default async function LeaveGroupPage({ params }: PageProps<"/admin/settings/leave/groups/[id]">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const policy = await db.leavePolicy.findFirst({ where: { id, schoolId: school.id } });
  if (!policy) notFound();
  const { members, inGroup } = await loadMembers(school.id);
  const selected = inGroup(policy.id);
  return (
    <>
      <PageHeader
        title={policy.name}
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Teacher & staff leave", href: "/admin/settings/leave" },
          { label: policy.name },
        ]}
        subtitle={`Leave group · ${selected.length} ${selected.length === 1 ? "member" : "members"}. Changes apply to this session's balances straight away.`}
        action={
          <ActionForm action={deleteLeavePolicy.bind(null, policy.id)} compact>
            <SubmitButton
              variant="dangerGhost"
              icon={<Trash2 className="h-4 w-4" />}
              confirm={`Delete ${policy.name}?`}
              confirmMessage="Its members go back to the school-wide allowance. Leave already taken is kept."
            >
              Delete group
            </SubmitButton>
          </ActionForm>
        }
      />
      <Card className="max-w-4xl">
        <LeaveGroupForm
          key={JSON.stringify([policy.name, policy.days, selected])}
          action={saveLeavePolicy.bind(null, policy.id)}
          name={policy.name}
          days={policyDays(policy.days)}
          members={members}
          selected={selected}
          groupName={policy.name}
        />
      </Card>
    </>
  );
}
