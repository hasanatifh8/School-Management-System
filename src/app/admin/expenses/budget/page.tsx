import { FolderPlus, PiggyBank, Tags, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Card, inputClass } from "@/components/ui";
import { monthSummary, requireExpensesAccess, suggestedBudgets } from "@/lib/expenses";
import { addCategory, deleteCategory } from "../actions";
import { BudgetForm } from "./budget-form";

/** Monthly budgets per category (the same every month) and the category list. */
export default async function BudgetPage() {
  const { school, today, month } = await requireExpensesAccess();
  const [summary, suggested] = await Promise.all([monthSummary(school.id, month, today), suggestedBudgets(school.id, month)]);
  const rows = summary.rows.map((r) => ({ id: r.id, name: r.name, isSalaries: r.isSalaries, budget: r.budget, suggested: suggested.get(r.id) ?? null, average: r.average }));

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card title="Monthly budget" icon={PiggyBank} description="What you plan to spend each month. Leave blank for no budget." className="xl:col-span-2">
        <BudgetForm rows={rows} />
      </Card>
      <div className="space-y-6 self-start">
        <Card title="Add a category" icon={FolderPlus}>
          <ActionForm action={addCategory} className="space-y-3">
            <Field label="Name" name="name" required>
              <input name="name" required maxLength={60} placeholder="e.g. Sports equipment" className={inputClass} />
            </Field>
            <Field label="Monthly budget (₹)" name="monthlyBudget">
              <input name="monthlyBudget" inputMode="numeric" className={inputClass} />
            </Field>
            <SubmitButton size="sm">Add category</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Categories" icon={Tags} padded={false}>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-6 py-2 text-sm">
                <span className="text-slate-800">{r.name}</span>
                {!r.isSalaries && (
                  <ActionForm action={deleteCategory.bind(null, r.id)} compact className="flex flex-row-reverse items-center gap-2">
                    <SubmitButton variant="dangerGhost" size="sm" confirm={`Remove the “${r.name}” category?`} icon={<Trash2 className="h-4 w-4" />}>
                      <span className="sr-only">Remove {r.name}</span>
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
