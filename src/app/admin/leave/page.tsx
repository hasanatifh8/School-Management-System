import { Settings2 } from "lucide-react";
import { DrillNav } from "@/components/attendance/drill-nav";
import { LeavePageContent } from "@/components/leave/leave-page";
import { ButtonLink } from "@/components/ui";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { bulkApproveLeave, decideLeave, deleteLeave } from "./actions";

/** Every leave request in the school: approve or reject pending ones. */
export default async function LeavePage({ searchParams }: PageProps<"/admin/leave">) {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  return (
    <LeavePageContent
      actor={{ kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" }}
      params={await searchParams}
      base="/admin/leave"
      subtitle="Leave for students, teachers and staff. Approved leave shows as Leave in attendance."
      whoOptions={[
        { value: "student", label: "Students" },
        { value: "teacher", label: "Teachers" },
        { value: "staff", label: "Staff" },
      ]}
      personHref={(r) => (r.person.href ? `/admin${r.person.href}` : null)}
      decide={(id) => decideLeave.bind(null, id)}
      withdraw={(id) => deleteLeave.bind(null, id)}
      bulkApprove={bulkApproveLeave}
      breadcrumbs={<DrillNav items={[{ label: "Leave" }]} />}
      headerExtra={
        <ButtonLink href="/admin/settings/leave" variant="secondary" icon={Settings2}>
          Teacher & staff leave days
        </ButtonLink>
      }
    />
  );
}
