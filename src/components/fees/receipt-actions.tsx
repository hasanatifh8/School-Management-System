import Link from "next/link";
import { Download, Eye, Printer } from "lucide-react";
import { cx } from "@/components/ui";

const action =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted transition hover:bg-surface-3 hover:text-fg [&_svg]:h-4 [&_svg]:w-4";

/** View, download (PDF) and print one receipt. Print opens it in a new tab and starts printing. */
export function ReceiptActions({ id, number, className }: { id: string; number: string; className?: string }) {
  return (
    <div className={cx("flex items-center justify-end gap-0.5", className)}>
      <Link href={`/admin/fees/receipts/${id}?from=receipts`} className={action} title={`View receipt ${number}`}>
        <Eye aria-hidden />
        <span className="hidden xl:inline">View</span>
        <span className="sr-only xl:hidden">View receipt {number}</span>
      </Link>
      <a href={`/api/fees/receipts/${id}`} download className={action} title={`Download receipt ${number} as PDF`}>
        <Download aria-hidden />
        <span className="hidden xl:inline">PDF</span>
        <span className="sr-only xl:hidden">Download receipt {number} as PDF</span>
      </a>
      <a href={`/admin/fees/receipts/${id}?print=1`} target="_blank" rel="noopener" className={action} title={`Print receipt ${number}`}>
        <Printer aria-hidden />
        <span className="hidden xl:inline">Print</span>
        <span className="sr-only xl:hidden">Print receipt {number}</span>
      </a>
    </div>
  );
}
