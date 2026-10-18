import { Settings2 } from "lucide-react";
import { PersonLeaveForm } from "@/components/leave/person-leave-form";
import { Card } from "@/components/ui";
import { loadAllowances, loadLeavePolicies, personLeaveSetup } from "@/lib/leave";
import { savePersonLeave } from "@/app/admin/leave/actions";

/** Admin card on a teacher's or staff member's profile: their leave group and extra days. */
export async function PersonLeaveSetup({ schoolId, person }: { schoolId: string; person: { teacherId: string } | { staffId: string } }) {
  const [setup, groups, allowances] = await Promise.all([personLeaveSetup(schoolId, person), loadLeavePolicies(schoolId), loadAllowances(schoolId)]);
  const schoolWide = allowances["teacherId" in person ? "TEACHER" : "STAFF"];
  return (
    <Card title="Leave days" icon={Settings2} description="Their leave group, and any extra days just for them this session.">
      <PersonLeaveForm
        key={JSON.stringify([setup.policyId, setup.extras])}
        action={savePersonLeave.bind(null, person)}
        groups={groups.map(({ id, name, days }) => ({ id, name, days }))}
        schoolWide={schoolWide}
        policyId={setup.policyId}
        extras={setup.extras}
        session={setup.session}
      />
    </Card>
  );
}
