import { notFound, redirect } from "next/navigation";
import { PayslipEditor } from "@/components/payroll/payslip-editor";
import { Card, PageHeader } from "@/components/ui";
import { requireExpensesAccess } from "@/lib/expenses";
import { MONTH_NAMES } from "@/lib/fees-shared";
import { loadPayslip } from "@/lib/payroll";
import { updatePayslip } from "../../../payroll/actions";

/** Edit a draft salary slip. Published slips must be unpublished first. */
export default async function EditPayslipPage({ params }: PageProps<"/admin/payslips/[id]/edit">) {
  const { id } = await params;
  const { school, today } = await requireExpensesAccess();
  const slip = await loadPayslip(school.id, id);
  if (!slip) notFound();
  if (slip.published) redirect(`/admin/payslips/${id}`);
  const monthName = `${MONTH_NAMES[Number(slip.month.slice(5)) - 1]} ${slip.month.slice(0, 4)}`;
  return (
    <>
      <PageHeader
        title={`Edit slip · ${slip.name}`}
        subtitle={`${monthName} · ${slip.role}. Give every deduction a reason: it's printed on the slip.`}
        breadcrumbs={[
          { label: "Payroll", href: `/admin/payroll?month=${slip.month}` },
          { label: slip.name, href: `/admin/payslips/${id}` },
          { label: "Edit" },
        ]}
      />
      <Card className="max-w-5xl">
        <PayslipEditor
          key={JSON.stringify([slip.lines, slip.lopDays, slip.paidOn, slip.mode, slip.note])}
          action={updatePayslip.bind(null, id)}
          lines={slip.lines}
          lopDays={slip.lopDays}
          paidOn={slip.paidOn}
          mode={slip.mode}
          note={slip.note}
          today={today}
        />
      </Card>
    </>
  );
}
