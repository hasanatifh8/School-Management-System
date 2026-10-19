import Link from "next/link";
import { CalendarClock, ChevronRight, FileCheck2, Plane, Plus, Save, UserCheck, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Callout, Card, EmptyState, PageHeader, checkboxClass, inputClass, tdClass, thClass, theadClass } from "@/components/ui";
import { loadAllowances, loadLeavePolicies, loadLeaveRules } from "@/lib/leave";
import { CATEGORY_LABELS, CATEGORY_SHORT, LEAVE_CATEGORIES, PROOF_REASON_MIN } from "@/lib/leave-shared";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { saveAllowances, saveLeaveRules } from "@/app/admin/leave/actions";

/**
 * Leave days the school's own teachers and non-teaching staff get each
 * session, per leave type: leave groups for chosen people, and the school-wide
 * allowance for everyone else. Students have no allowance.
 */
export default async function StaffLeaveSettingsPage() {
  const school = await getCurrentSchool();
  const [allowances, session, groups, rules] = await Promise.all([loadAllowances(school.id), getCurrentSession(school.id), loadLeavePolicies(school.id), loadLeaveRules(school.id)]);
  return (
    <>
      <PageHeader
        title="Teacher & staff leave"
        subtitle={`Leave days (PL, sick, casual…) the school's own teachers and non-teaching staff get each session, now ${session.name}. Balances reset every session.`}
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Teacher & staff leave" }]}
        action={
          <>
            <ButtonLink href="/admin/leave?who=teacher" variant="secondary" icon={Plane}>
              Leave requests
            </ButtonLink>
            <ButtonLink href="/admin/settings/leave/groups/new" icon={Plus}>
              New leave group
            </ButtonLink>
          </>
        }
      />
      <Callout icon={UserCheck} tone="info" className="mb-6 max-w-4xl">
        <strong>For school employees only:</strong> teachers and non-teaching staff on the school&apos;s rolls. Students don&apos;t get leave days; their leave
        is approved by the class teacher and shows in attendance.
      </Callout>
      <Card
        className="mb-6 max-w-4xl"
        title="Leave groups"
        icon={Users}
        description="Give a group of teachers or staff their own leave days, e.g. more PL for senior teachers. Extra days for one person are set on their profile."
        padded={false}
      >
        {groups.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No leave groups yet"
            description="Everyone gets the school-wide allowance below."
            action={
              <ButtonLink href="/admin/settings/leave/groups/new" icon={Plus} size="sm" variant="secondary">
                New leave group
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {groups.map((g) => {
              const set = LEAVE_CATEGORIES.filter((c) => g.days[c] != null);
              return (
                <li key={g.id}>
                  <Link
                    href={`/admin/settings/leave/groups/${g.id}`}
                    className="group flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2 sm:px-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-fg group-hover:text-accent-text">{g.name}</span>
                      <span className="block text-xs text-muted">
                        {g.teachers} teacher{g.teachers === 1 ? "" : "s"} · {g.staff} staff
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {set.length === 0 ? (
                        <span className="text-xs text-muted">No limits</span>
                      ) : (
                        set.map((c) => (
                          <span key={c} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-fg-2 ring-1 ring-inset ring-line">
                            {CATEGORY_SHORT[c]} <strong className="text-fg">{g.days[c]}</strong>
                          </span>
                        ))
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-subtle group-hover:text-accent-text" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card
        className="mb-6 max-w-4xl"
        title="Leave rules"
        icon={CalendarClock}
        description="How many days of each type count as leave in one month, and which types need proof. Every teacher and staff leave still waits for an admin's approval."
        padded={false}
      >
        <ActionForm action={saveLeaveRules} keepValues>
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Leave type</th>
                    <th className={thClass}>Teachers · days a month</th>
                    <th className={thClass}>Non-teaching staff · days a month</th>
                    <th className={thClass}>Needs proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {LEAVE_CATEGORIES.map((c) => (
                    <tr key={c}>
                      <td className={`${tdClass} font-medium text-fg`}>{CATEGORY_LABELS[c]}</td>
                      {(["TEACHER", "STAFF"] as const).map((a) => (
                        <td key={a} className={tdClass}>
                          <label className="flex items-center gap-2">
                            <input
                              type="number"
                              name={`m:${a}:${c}`}
                              min={0}
                              max={31}
                              step={1}
                              defaultValue={rules.monthly[a][c] ?? ""}
                              placeholder="No limit"
                              aria-label={`${CATEGORY_LABELS[c]}: days a month for ${a === "TEACHER" ? "teachers" : "staff"}`}
                              className={`${inputClass} w-28`}
                            />
                            <span className="text-xs text-muted">a month</span>
                          </label>
                        </td>
                      ))}
                      <td className={tdClass}>
                        <label className="flex items-center gap-2 text-fg-2">
                          <input type="checkbox" name="proof" value={c} defaultChecked={rules.proof.includes(c)} className={checkboxClass} />
                          <FileCheck2 className="h-4 w-4 text-subtle" aria-hidden />
                          <span className="sr-only">{CATEGORY_LABELS[c]} needs proof</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 border-t border-line px-4 py-4 sm:px-6">
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                <li>
                  <strong className="font-medium text-fg-2">Days a month:</strong> e.g. PL 2 means only the first 2 working days of PL approved in a month count as leave.
                  Days beyond that are marked absent and deducted from salary (loss of pay). The applicant is warned before applying.
                </li>
                <li>
                  <strong className="font-medium text-fg-2">Needs proof:</strong> the application must attach a document (e.g. a medical certificate) and give a written
                  reason of at least {PROOF_REASON_MIN} characters.
                </li>
              </ul>
              <div className="flex justify-end">
                <SubmitButton icon={<Save className="h-4 w-4" />}>Save leave rules</SubmitButton>
              </div>
            </div>
          </>
        </ActionForm>
      </Card>
      <Card
        className="max-w-2xl"
        title="School-wide allowance"
        description="For teachers and staff who aren't in a leave group. Leave blank for no limit."
        padded={false}
      >
        <ActionForm action={saveAllowances} keepValues>
          <>
            <table className="min-w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Leave type</th>
                  <th className={thClass}>Teachers</th>
                  <th className={thClass}>Non-teaching staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LEAVE_CATEGORIES.map((c) => (
                  <tr key={c}>
                    <td className={`${tdClass} font-medium text-fg`}>{CATEGORY_LABELS[c]}</td>
                    {(["TEACHER", "STAFF"] as const).map((a) => (
                      <td key={a} className={tdClass}>
                        <label className="flex items-center gap-2">
                          <input
                            type="number"
                            name={`a:${a}:${c}`}
                            min={0}
                            max={365}
                            step={1}
                            defaultValue={allowances[a][c] ?? ""}
                            placeholder="No limit"
                            aria-label={`${CATEGORY_LABELS[c]} days for ${a === "TEACHER" ? "teachers" : "staff"}`}
                            className={`${inputClass} w-28`}
                          />
                          <span className="text-xs text-muted">days</span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-4 sm:px-6">
              <p className="text-xs text-muted">Leave over the allowance can still be approved; the review drawer warns it would be loss of pay.</p>
              <SubmitButton icon={<Save className="h-4 w-4" />}>Save allowances</SubmitButton>
            </div>
          </>
        </ActionForm>
      </Card>
    </>
  );
}
