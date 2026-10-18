import { notFound } from "next/navigation";
import { CircleCheck, EyeOff, FilePen, Send } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SalarySlipView } from "@/components/payroll/salary-slip-view";
import { ButtonLink, Callout } from "@/components/ui";
import { requireExpensesAccess } from "@/lib/expenses";
import { loadPayslip } from "@/lib/payroll";
import { publishPayslip, unpublishPayslip } from "../../payroll/actions";

const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** A teacher's or staff member's salary slip, opened from payroll or their Salary tab: check, edit and publish it. */
export default async function PayslipPage({ params }: PageProps<"/admin/payslips/[id]">) {
  const { id } = await params;
  const { school } = await requireExpensesAccess();
  const slip = await loadPayslip(school.id, id);
  if (!slip) notFound();
  const first = slip.name.split(" ")[0];
  return (
    <SalarySlipView
      slip={slip}
      back={{ href: `/admin/payroll?month=${slip.month}`, label: "Payroll" }}
      actions={
        slip.published ? (
          <ActionForm action={unpublishPayslip.bind(null, slip.id)} compact className="flex flex-row-reverse items-center gap-2">
            <SubmitButton
              variant="ghost"
              icon={<EyeOff className="h-4 w-4" />}
              confirm={`Unpublish ${first}'s slip?`}
              confirmMessage="It goes back to draft, hidden from them, and can be edited."
            >
              Unpublish
            </SubmitButton>
          </ActionForm>
        ) : (
          <>
            <ButtonLink href={`/admin/payslips/${slip.id}/edit`} variant="secondary" icon={FilePen}>
              Edit
            </ButtonLink>
            <ActionForm action={publishPayslip.bind(null, slip.id)} compact className="flex flex-row-reverse items-center gap-2">
              <SubmitButton icon={<Send className="h-4 w-4" />} confirm={`Publish ${first}'s slip?`} confirmMessage="They will be able to see, print and download it.">
                Publish
              </SubmitButton>
            </ActionForm>
          </>
        )
      }
      banner={
        slip.published ? (
          <Callout icon={CircleCheck} tone="success">
            Published{slip.published.at ? ` ${stamp.format(new Date(slip.published.at))}` : ""}
            {slip.published.by ? ` by ${slip.published.by}` : ""}. {first} can see this slip. Unpublish it to make changes.
          </Callout>
        ) : (
          <Callout icon={EyeOff} tone="warning">
            <strong>Draft.</strong> {first} can&apos;t see this slip yet. Check it, edit anything that&apos;s wrong, then publish.
          </Callout>
        )
      }
    />
  );
}
