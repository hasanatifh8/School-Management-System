import { ArrowLeft } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PdfDownloadButton } from "@/components/pdf-download";
import { PrintButton } from "@/components/print-button";
import { SalarySlip } from "@/components/payroll/salary-slip";
import { buttonVariants } from "@/components/ui";
import type { Payslip } from "@/lib/payroll";

/** A salary slip with Back, Print and Download PDF (admin and teacher portals). */
export function SalarySlipView({ slip, back }: { slip: Payslip; back: { href: string; label: string } }) {
  const fileName = `Salary slip ${slip.month} ${slip.name}`.replace(/[^\w\- ]+/g, "");
  return (
    <div className="space-y-4">
      <style>{"@page { size: A4 portrait; margin: 10mm; } @media print { html, body { background: #fff !important; } }"}</style>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <BackLink href={back.href} className={buttonVariants.ghost}>
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </BackLink>
        <span className="flex-1" />
        <PdfDownloadButton root="salary-slip" fileName={fileName} />
        <PrintButton label="Print slip" />
      </div>
      <div data-pdf-root="salary-slip">
        <SalarySlip slip={slip} />
      </div>
    </div>
  );
}
