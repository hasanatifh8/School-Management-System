import Link from "next/link";
import { Pencil, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { rupees } from "@/lib/fees-shared";
import { getCurrentSchool } from "@/lib/school";
import { saveStaffMember, setStaffMemberStatus } from "../expenses/actions";
import { StaffMemberForm } from "./staff-member-form";

/** Non-teaching staff (office, guards, helpers, drivers…) and their monthly salaries. */
export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const school = await getCurrentSchool();
  const showRemoved = (await searchParams).removed === "1";
  const staff = await db.staffMember.findMany({
    where: { schoolId: school.id, status: showRemoved ? "INACTIVE" : "ACTIVE" },
    orderBy: [{ designation: "asc" }, { name: "asc" }],
  });
  const payroll = staff.reduce((n, s) => n + (s.monthlySalary ?? 0), 0);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card
        title={showRemoved ? "Removed staff" : `${staff.length} on the payroll`}
        description={showRemoved ? "No longer paid. Their past salaries stay on record." : `${rupees(payroll)} a month in salaries`}
        icon={Users}
        padded={false}
        className="xl:col-span-2"
        action={
          <Link href={showRemoved ? "/admin/staff" : "/admin/staff?removed=1"} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            {showRemoved ? "Current staff" : "Removed"}
          </Link>
        }
      >
        {staff.length === 0 ? (
          <EmptyState icon={Users} title={showRemoved ? "No removed staff" : "No non-teaching staff yet"} description={showRemoved ? undefined : "Add office staff, guards, helpers, drivers and others you pay each month."} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {staff.map((s) => (
              <li key={s.id} className="px-6 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={s.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {s.name} <Badge>{s.designation}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">{[s.phone, s.joiningDate && `joined ${s.joiningDate.toISOString().slice(0, 10)}`].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-slate-900">{s.monthlySalary ? `${rupees(s.monthlySalary)}/mo` : <span className="font-normal text-amber-700">No salary set</span>}</p>
                  <ActionForm action={setStaffMemberStatus.bind(null, s.id, showRemoved ? "ACTIVE" : "INACTIVE")} compact className="flex flex-row-reverse items-center gap-2">
                    <SubmitButton variant="ghost" size="sm" confirm={showRemoved ? undefined : `Remove ${s.name} from the payroll?`} icon={showRemoved ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}>
                      {showRemoved ? "Restore" : "Remove"}
                    </SubmitButton>
                  </ActionForm>
                </div>
                <details className="mt-2 pl-11">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                    <Pencil className="h-3.5 w-3.5" /> Edit details
                  </summary>
                  <div className="mt-3">
                    <StaffMemberForm action={saveStaffMember.bind(null, s.id)} member={s} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!showRemoved && (
        <Card title="Add staff member" icon={UserPlus} className="self-start">
          <StaffMemberForm action={saveStaffMember.bind(null, null)} />
        </Card>
      )}
    </div>
  );
}
