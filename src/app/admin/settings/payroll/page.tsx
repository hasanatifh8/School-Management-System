import { Banknote, CircleMinus, CirclePlus, Info, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { DialogButton } from "@/components/dialog-button";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Callout, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { CALC_LABELS, valueLabel } from "@/lib/payroll-shared";
import { getCurrentSchool } from "@/lib/school";
import { deleteSalaryComponent, saveSalaryComponent, setSalaryComponentActive } from "./actions";
import { SalaryComponentForm } from "./component-form";

/** The school's salary components: earnings and deductions on every salary, with their defaults. */
export default async function PayrollSettingsPage() {
  const school = await getCurrentSchool();
  const components = await db.salaryComponent.findMany({
    where: { schoolId: school.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { values: true } } },
  });

  const group = (kind: "EARNING" | "DEDUCTION") => {
    const list = components.filter((c) => c.kind === kind);
    const earning = kind === "EARNING";
    return (
      <Card
        title={earning ? "Earnings" : "Deductions"}
        icon={earning ? CirclePlus : CircleMinus}
        description={earning ? "Added to basic pay, e.g. HRA, DA, conveyance." : "Taken off the salary, e.g. provident fund, professional tax."}
        padded={false}
      >
        {list.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted">{earning ? "No earnings besides basic pay yet." : "No deductions yet."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id} className={`flex flex-wrap items-center gap-3 px-6 py-3.5 ${c.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {c.name}
                    {!c.active && <Badge>Off</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {CALC_LABELS[c.calc]} · default {c.defaultValue == null ? "none (only people given a value)" : valueLabel(c.calc, c.defaultValue)}
                    {c._count.values > 0 && ` · ${c._count.values} with their own value`}
                  </p>
                </div>
                <DialogButton label="Edit" icon={<Pencil className="h-4 w-4" />} variant="ghost" title={`Edit ${c.name}`}>
                  <SalaryComponentForm
                    action={saveSalaryComponent.bind(null, c.id)}
                    initial={{ name: c.name, kind: c.kind, calc: c.calc, defaultValue: c.defaultValue }}
                    submitLabel="Save"
                  />
                </DialogButton>
                <ActionForm action={setSalaryComponentActive.bind(null, c.id, !c.active)} compact className="flex items-center">
                  <SubmitButton variant="ghost" size="sm" icon={<Power className="h-4 w-4" />}>
                    {c.active ? "Turn off" : "Turn on"}
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={deleteSalaryComponent.bind(null, c.id)} compact className="flex items-center">
                  <SubmitButton variant="ghost" size="sm" confirm={`Delete ${c.name}? Everyone's own values for it are removed; slips already paid keep it.`} icon={<Trash2 className="h-4 w-4" />}>
                    <span className="sr-only">Delete {c.name}</span>
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="The parts of every salary. Each teacher's and staff member's basic pay, and any values of their own, are set on their profile's Salary tab."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Payroll" }]}
        action={
          <>
            <ButtonLink href="/admin/expenses/salaries" variant="secondary" icon={Banknote}>
              Pay salaries
            </ButtonLink>
            <DialogButton label="Add component" icon={<Plus className="h-4 w-4" />} variant="primary" title="Add a salary component">
              <SalaryComponentForm action={saveSalaryComponent.bind(null, null)} submitLabel="Add" />
            </DialogButton>
          </>
        }
      />
      {components.length === 0 && (
        <Card className="mb-6">
          <EmptyState
            icon={Banknote}
            title="Only basic pay so far"
            description="Add earnings like HRA or DA and deductions like provident fund. Give each a default (fixed ₹ or % of basic pay); change it for anyone on their profile."
          />
        </Card>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {group("EARNING")}
        {group("DEDUCTION")}
      </div>
      <Callout icon={Info} className="mt-6">
        Net pay = basic pay + earnings − deductions. Unpaid days (absent days and half of each half day, not on approved leave) are taken off only when you tick
        &ldquo;Deduct unpaid days&rdquo; while paying: a day&apos;s pay is the month&apos;s gross divided by its days. Changes apply to months not yet paid; paid slips stay as they were.
      </Callout>
    </>
  );
}
