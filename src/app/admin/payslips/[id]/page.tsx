import { notFound } from "next/navigation";
import { SalarySlipView } from "@/components/payroll/salary-slip-view";
import { requireExpensesAccess } from "@/lib/expenses";
import { loadPayslip } from "@/lib/payroll";

/** A teacher's or staff member's salary slip, opened from payroll or their Salary tab. */
export default async function PayslipPage({ params }: PageProps<"/admin/payslips/[id]">) {
  const { id } = await params;
  const { school } = await requireExpensesAccess();
  const slip = await loadPayslip(school.id, id);
  if (!slip) notFound();
  return <SalarySlipView slip={slip} back={{ href: `/admin/expenses/salaries?month=${slip.month}`, label: "Salaries" }} />;
}
