import { Suspense } from "react";
import { TabCrumbs } from "@/components/tab-crumbs";
import { PageHeader } from "@/components/ui";
import { requireExpensesAccess } from "@/lib/expenses";
import { ExpensesTabs } from "./expenses-tabs";

export default async function ExpensesLayout({ children }: LayoutProps<"/admin/expenses">) {
  await requireExpensesAccess();
  return (
    <>
      <TabCrumbs crumbs={{ "/admin/expenses/budget": [{ label: "Settings", href: "/admin/settings" }, { label: "Monthly budgets" }] }} />
      <PageHeader title="Expenses" subtitle="Salaries and running costs, against your monthly budget." />
      <Suspense>
        <ExpensesTabs />
      </Suspense>
      {children}
    </>
  );
}
