"use client";

import { Save, Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonVariants, inputClass } from "@/components/ui";
import { rupees } from "@/lib/fees-shared";
import { saveBudgets } from "../actions";

type Row = { id: string; name: string; isSalaries: boolean; budget: number | null; suggested: number | null; average: number };

/** Monthly budget per category, with a suggestion from recent spending. */
export function BudgetForm({ rows }: { rows: Row[] }) {
  const fill = (id: string, v: number) => {
    const input = document.querySelector<HTMLInputElement>(`input[name="budget:${id}"]`);
    if (input) input.value = String(v);
  };
  const total = rows.reduce((n, r) => n + (r.budget ?? 0), 0);
  return (
    <ActionForm action={saveBudgets} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Monthly budget</th>
              <th className="py-2 pr-3 text-right">Usual (3 mo)</th>
              <th className="py-2">Suggested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3 font-medium text-slate-900">
                  {r.name}
                  {r.isSalaries && <span className="block text-xs font-normal text-slate-500">Teaching + non-teaching payroll</span>}
                </td>
                <td className="py-2 pr-3">
                  <div className="relative w-40">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                    <input
                      name={`budget:${r.id}`}
                      inputMode="numeric"
                      defaultValue={r.budget ?? ""}
                      placeholder="No budget"
                      aria-label={`${r.name} monthly budget`}
                      className={`${inputClass} !py-2 pl-7 tabular-nums`}
                    />
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{r.average ? rupees(r.average) : "—"}</td>
                <td className="py-2">
                  {r.suggested ? (
                    <button
                      type="button"
                      onClick={() => fill(r.id, r.suggested!)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Use {rupees(r.suggested)}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200">
              <td className="py-2 pr-3 font-semibold text-slate-900">Total monthly budget (saved)</td>
              <td className="py-2 pr-3 font-semibold tabular-nums text-slate-900">{rupees(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton icon={<Save className="h-4 w-4" />}>Save budgets</SubmitButton>
        <button
          type="button"
          onClick={() => rows.forEach((r) => r.suggested && fill(r.id, r.suggested))}
          className={buttonVariants.secondary}
        >
          <Sparkles className="h-4 w-4" />
          Use all suggestions
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Suggestions: salaries use this month&apos;s payroll; other categories use the last 3 months&apos; average plus 10%, rounded up to
        ₹500.
      </p>
    </ActionForm>
  );
}
