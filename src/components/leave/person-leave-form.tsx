"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inputClass, selectClass, tdClass, thClass, theadClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { CATEGORY_LABELS, LEAVE_CATEGORIES, type LeaveCategoryKey } from "@/lib/leave-shared";

type Days = Partial<Record<LeaveCategoryKey, number>>;

/**
 * One person's leave group and this session's extra days. The table shows the
 * days the chosen group gives (or the school-wide allowance), the extra days,
 * and the total they get.
 */
export function PersonLeaveForm({
  action,
  groups,
  schoolWide,
  policyId,
  extras,
  session,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  groups: { id: string; name: string; days: Days }[];
  schoolWide: Days;
  policyId: string | null;
  extras: Days;
  session: string;
}) {
  const [group, setGroup] = useState(policyId ?? "");
  const [extra, setExtra] = useState<Record<string, string>>(() =>
    Object.fromEntries(LEAVE_CATEGORIES.map((c) => [c, extras[c] ? String(extras[c]) : ""])),
  );
  const base = groups.find((g) => g.id === group)?.days ?? schoolWide;

  return (
    <ActionForm action={action} keepValues className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-fg-2">Leave group</span>
        <select name="policy" value={group} onChange={(e) => setGroup(e.target.value)} className={selectClass}>
          <option value="">None (school-wide allowance)</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Type</th>
              <th className={`${thClass} text-right`}>{group ? "Group" : "School-wide"}</th>
              <th className={`${thClass} text-right`}>Extra · {session}</th>
              <th className={`${thClass} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {LEAVE_CATEGORIES.map((c) => {
              const b = base[c];
              const x = Number(extra[c]) || 0;
              return (
                <tr key={c}>
                  <td className={`${tdClass} font-medium text-fg`}>{CATEGORY_LABELS[c]}</td>
                  <td className={`${tdClass} text-right tabular-nums text-fg-2`}>{b ?? "No limit"}</td>
                  <td className={`${tdClass} text-right`}>
                    <input
                      type="number"
                      name={`x:${c}`}
                      min={-365}
                      max={365}
                      step={1}
                      value={extra[c]}
                      onChange={(e) => setExtra((prev) => ({ ...prev, [c]: e.target.value }))}
                      disabled={b == null}
                      placeholder={b == null ? "—" : "0"}
                      aria-label={`Extra ${CATEGORY_LABELS[c]} days`}
                      className={`${inputClass} ml-auto w-20 text-right`}
                    />
                  </td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums ${x ? "text-accent-text" : "text-fg"}`}>
                    {b == null ? "No limit" : Math.max(0, b + x)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Extra days count for this session only. Use a minus number to take days off.</p>
        <SubmitButton icon={<Save className="h-4 w-4" />}>Save leave</SubmitButton>
      </div>
    </ActionForm>
  );
}
