import { notFound, redirect } from "next/navigation";
import { Banknote, Eye } from "lucide-react";
import { SalarySlipView } from "@/components/payroll/salary-slip-view";
import { ButtonLink, Callout } from "@/components/ui";
import { addMonths } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { isMonth, requireExpensesAccess } from "@/lib/expenses";
import { MONTH_NAMES, rupees } from "@/lib/fees-shared";
import { dayCount } from "@/lib/payroll-shared";
import { previewPayslip } from "@/lib/payroll";

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The salary slip a teacher or staff member would get for a month not paid yet
 * (also mid-month), worked out now. Paying makes the real slip; this one is
 * never shown to the employee.
 */
export default async function PayslipPreviewPage({ searchParams }: PageProps<"/admin/payroll/preview">) {
  const sp = await searchParams;
  const { school, month: current } = await requireExpensesAccess();
  const key = typeof sp.person === "string" ? sp.person : "";
  const month = isMonth(sp.month) && sp.month <= addMonths(current, 1) ? sp.month : current;

  // Already paid: the saved slip is the real one.
  const id = key.slice(2);
  const paid = id
    ? await db.salaryPayment.findFirst({ where: { schoolId: school.id, month, ...(key.startsWith("T:") ? { teacherId: id } : { staffId: id }) }, select: { id: true } })
    : null;
  if (paid) redirect(`/admin/payslips/${paid.id}`);

  const slip = await previewPayslip(school.id, key, month);
  if (!slip) notFound();
  const first = slip.name.split(" ")[0];
  const monthName = `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  const started = slip.preview!.asOf >= `${month}-01`;
  const lop = slip.preview!.lopAmount;

  return (
    <SalarySlipView
      slip={slip}
      back={{ href: `/admin/payroll?month=${month}`, label: "Payroll" }}
      actions={
        <ButtonLink href={`/admin/payroll?month=${month}&pay=${encodeURIComponent(key)}`} variant="secondary" icon={Banknote}>
          Pay salary
        </ButtonLink>
      }
      banner={
        <Callout icon={Eye} tone="info">
          <strong>Preview.</strong> {first} isn&apos;t paid for {monthName} yet, so this slip is worked out from the salary structure
          {started ? `, with attendance up to ${day.format(new Date(`${slip.preview!.asOf}T00:00:00Z`))}` : " (the month hasn't started, so no attendance yet)"}. Only
          admins see it.
          {lop > 0 && slip.lopDays
            ? ` ${dayCount(slip.lopDays)} unpaid so far are deducted (${rupees(lop)}); you can choose not to deduct them when paying.`
            : ""}{" "}
          The real slip is made when you pay, as a draft to check and publish.
        </Callout>
      }
    />
  );
}
