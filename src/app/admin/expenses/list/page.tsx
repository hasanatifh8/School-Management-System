import Link from "next/link";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { MonthPicker } from "@/components/expenses/month-picker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pagination } from "@/components/pagination";
import { Card, EmptyState, Table, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { db } from "@/lib/db";
import { ensureCategories, isMonth, monthBounds, requireExpensesAccess } from "@/lib/expenses";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { paginate } from "@/lib/pagination";
import { deleteExpense } from "../actions";
import { ExpenseForm } from "./expense-form";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** A month's non-salary expenses, filterable by category, with the add form. */
export default async function ExpenseListPage({ searchParams }: PageProps<"/admin/expenses/list">) {
  const sp = await searchParams;
  const { school, today, month: current } = await requireExpensesAccess();
  const month = isMonth(sp.month) && sp.month <= current ? sp.month : current;
  const categories = (await ensureCategories(school.id)).filter((c) => !c.isSalaries);
  const category = categories.find((c) => c.id === sp.category);
  const { from, to } = monthBounds(month);
  const where = { schoolId: school.id, date: { gte: from, lte: to }, ...(category && { categoryId: category.id }) };
  const summary = await db.expense.aggregate({ where, _sum: { amount: true }, _count: true });
  const paging = paginate(sp, summary._count);
  const expenses = await db.expense.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: paging.skip,
    take: paging.take,
    include: { category: { select: { name: true } } },
  });
  const total = summary._sum.amount ?? 0;
  const base = `/admin/expenses/list?month=${month}`;

  return (
    <div className="space-y-6">
      <MonthPicker basePath="/admin/expenses/list" month={month} max={current} current={current} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2" title={`${category ? category.name : "All expenses"} · ${rupees(total)}`} description={`${paging.total} entr${paging.total === 1 ? "y" : "ies"}. Salaries are on the Salaries tab.`}>
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-6 py-3">
            <Link href={base} className={`rounded-full px-3 py-1 text-xs font-medium ${!category ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              All
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={`${base}&category=${c.id}`} className={`rounded-full px-3 py-1 text-xs font-medium ${category?.id === c.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {c.name}
              </Link>
            ))}
          </div>
          {expenses.length === 0 ? (
            <EmptyState icon={Receipt} title="Nothing recorded" description="Add bills and payments with the form." />
          ) : (
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Expense</th>
                  <th className={thClass}>Paid by</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>
                    <span className="sr-only">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {expenses.map((e) => (
                  <tr key={e.id} className={trClass}>
                    <td className={`${tdClass} whitespace-nowrap`}>{dateFmt.format(e.date)}</td>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-900">{e.category.name}</p>
                      <p className="text-xs text-slate-500">{[e.paidTo, e.description].filter(Boolean).join(" · ") || "—"}</p>
                    </td>
                    <td className={tdClass}>
                      {MODE_LABELS[e.mode]}
                      {e.reference && <p className="text-xs text-slate-500">{e.reference}</p>}
                    </td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{rupees(e.amount)}</td>
                    <td className={`${tdClass} text-right`}>
                      <ActionForm action={deleteExpense.bind(null, e.id)} compact className="flex flex-row-reverse items-center gap-2">
                        <SubmitButton variant="dangerGhost" size="sm" confirm={`Delete this ${rupees(e.amount)} ${e.category.name} expense?`} icon={<Trash2 className="h-4 w-4" />}>
                          <span className="sr-only">Delete</span>
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pagination paging={paging} noun="expenses" />
        </Card>
        <Card title="Add expense" icon={Plus} className="self-start">
          <ExpenseForm categories={categories} today={today} defaultCategory={category?.id} />
        </Card>
      </div>
    </div>
  );
}
