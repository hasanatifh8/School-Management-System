import { Save } from "lucide-react";
import { DrillNav } from "@/components/attendance/drill-nav";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader, inputClass, tdClass, thClass, theadClass } from "@/components/ui";
import { loadAllowances } from "@/lib/leave";
import { CATEGORY_LABELS, LEAVE_CATEGORIES } from "@/lib/leave-shared";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { saveAllowances } from "../actions";

/** Leave days teachers and staff get each session, per leave type; the review drawer shows what's left. */
export default async function LeaveAllowancesPage() {
  const school = await getCurrentSchool();
  const [allowances, session] = await Promise.all([loadAllowances(school.id), getCurrentSession(school.id)]);
  return (
    <>
      <DrillNav items={[{ label: "Leave", href: "/admin/leave" }, { label: "Leave allowances" }]} />
      <PageHeader
        title="Leave allowances"
        subtitle={`Working days each person gets per session (now ${session.name}). Leave blank for no limit. Students have no allowance.`}
      />
      <Card className="max-w-2xl" padded={false}>
        <ActionForm action={saveAllowances} keepValues>
          {() => (
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
          )}
        </ActionForm>
      </Card>
    </>
  );
}
