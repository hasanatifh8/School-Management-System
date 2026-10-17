import { CalendarRange, Hourglass, Plane, Undo2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LeaveForm } from "@/components/leave/leave-form";
import { LeaveHistory } from "@/components/leave/leave-history";
import { Card, PageHeader } from "@/components/ui";
import { formatISO, shortDate, todayISO } from "@/lib/attendance-shared";
import { personLeave } from "@/lib/leave";
import { CATEGORY_LABELS } from "@/lib/leave-shared";
import { requireStudent } from "@/lib/student-auth";
import { applyStudentLeave, withdrawStudentLeave } from "../actions";

/** The student's leave: apply for it, see each request's decision, and withdraw one still waiting. */
export default async function StudentLeavePage() {
  const { student, school } = await requireStudent();
  const leave = await personLeave(school.id, "STUDENT", student.id);
  const waiting = leave.filter((r) => r.status === "PENDING");
  return (
    <>
      <PageHeader title="Leave" subtitle="Apply for leave; your class teacher approves it. Approved leave shows as Leave in your attendance." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {waiting.length > 0 && (
            <Card title="Waiting for a decision" icon={Hourglass} padded={false}>
              <ul className="divide-y divide-line">
                {waiting.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <CalendarRange className="h-4 w-4 shrink-0 text-subtle" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-fg">
                        {r.from === r.to ? formatISO(r.from, shortDate) : `${formatISO(r.from, shortDate)} – ${formatISO(r.to, shortDate)}`} · {r.days} day{r.days === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-muted">
                        {CATEGORY_LABELS[r.category]}
                        {r.description && ` · ${r.description}`}
                      </p>
                    </div>
                    <ActionForm action={withdrawStudentLeave.bind(null, r.id)} compact className="flex flex-row-reverse items-center gap-2">
                      <SubmitButton variant="ghost" size="sm" confirm="Withdraw this leave request?" icon={<Undo2 className="h-4 w-4" />}>
                        Withdraw
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <LeaveHistory leave={leave} noun="student" openHref={null} />
        </div>
        <Card title="Apply for leave" icon={Plane} description="For a day or several. Attach a medical certificate if you have one." className="xl:sticky xl:top-6">
          <LeaveForm action={applyStudentLeave} people={[]} self="STUDENT" canApproveNow={false} today={todayISO()} />
        </Card>
      </div>
    </>
  );
}
