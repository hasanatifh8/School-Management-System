import Link from "next/link";
import { Banknote, FileText, ReceiptText, Wallet } from "lucide-react";
import { SalaryBreakdown } from "@/components/payroll/salary-breakdown";
import { SalaryStructureForm } from "@/components/payroll/salary-structure-form";
import { Badge, Card, EmptyState, PagedList } from "@/components/ui";
import { db } from "@/lib/db";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { loadComponents, loadOwnValues } from "@/lib/payroll";
import { computeSalary } from "@/lib/payroll-shared";
import { saveSalaryStructure } from "@/app/admin/settings/payroll/actions";

const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A teacher's or staff member's Salary tab: their salary structure, and every salary paid with its slip. */
export async function SalaryTab({ schoolId, person, basic }: { schoolId: string; person: { teacherId: string } | { staffId: string }; basic: number | null }) {
  const key = "teacherId" in person ? `T:${person.teacherId}` : `S:${person.staffId}`;
  const [components, own, payments] = await Promise.all([
    loadComponents(schoolId),
    loadOwnValues(schoolId, person),
    db.salaryPayment.findMany({ where: { schoolId, ...person }, orderBy: [{ month: "desc" }, { createdAt: "desc" }] }),
  ]);
  const salary = basic ? computeSalary(basic, components, own.get(key) ?? {}) : null;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Card title="Salary structure" icon={Wallet} description="Basic pay plus the school's earnings and deductions. Applies to months not yet paid.">
          <SalaryStructureForm action={saveSalaryStructure.bind(null, person)} basic={basic} components={components} own={own.get(key) ?? {}} />
        </Card>
        <Card title="Monthly salary slip" icon={ReceiptText} description="The saved structure as it is paid each month, before any unpaid days.">
          {salary ? <SalaryBreakdown salary={salary} /> : <p className="text-sm text-muted">Enter basic pay above and save to see the salary slip.</p>}
        </Card>
      </div>
      <Card title="Salaries paid" icon={Banknote} description={payments.length ? `${payments.length} payment${payments.length === 1 ? "" : "s"}` : undefined} padded={false}>
        {payments.length === 0 ? (
          <EmptyState compact icon={Banknote} title="No salary paid yet" description="Pay it from Expenses → Salaries." />
        ) : (
          <PagedList pageSize={8} noun="payments">
            {payments.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/payslips/${p.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-surface-2">
                  <FileText className="h-4 w-4 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-fg">{monthFormat.format(new Date(`${p.month}-01T00:00:00Z`))}</span>
                    <span className="block text-xs text-muted">
                      {MODE_LABELS[p.mode]} · paid {dateFormat.format(p.paidOn)}
                      {p.lopDays ? ` · ${p.lopDays} unpaid day${p.lopDays === 1 ? "" : "s"} deducted` : ""}
                    </span>
                  </span>
                  {!p.published && (
                    <Badge tone="amber" dot>
                      Draft
                    </Badge>
                  )}
                  <span className="font-semibold tabular-nums text-fg">{rupees(p.amount)}</span>
                </Link>
              </li>
            ))}
          </PagedList>
        )}
      </Card>
    </div>
  );
}
