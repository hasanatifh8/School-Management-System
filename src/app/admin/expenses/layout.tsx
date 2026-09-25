import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { requireExpensesAccess } from "@/lib/expenses";
import { ExpensesTabs } from "./expenses-tabs";

export default async function ExpensesLayout({ children }: LayoutProps<"/admin/expenses">) {
  await requireExpensesAccess();
  return (
    <>
      <PageHeader title="Expenses" subtitle="Salaries and running costs, against your monthly budget." />
      <Suspense>
        <ExpensesTabs />
      </Suspense>
      {children}
    </>
  );
}
