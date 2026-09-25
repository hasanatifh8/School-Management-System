import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, GraduationCap, XCircle } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Card, buttonVariants, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess } from "@/lib/fees";
import { MODE_LABELS, amountInWords, rupees } from "@/lib/fees-shared";
import { schoolLogoUrl } from "@/lib/school";
import { cancelReceipt } from "../../actions";
import { PrintButton } from "./print-button";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** A printable fee receipt: parent and office copies on one A4 sheet (or one copy). */
export default async function ReceiptPage({ params, searchParams }: PageProps<"/admin/fees/receipts/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { school, canManage } = await getFeesAccess();
  const receipt = await db.feeReceipt.findFirst({
    where: { id, schoolId: school.id },
    include: { items: { orderBy: { id: "asc" } }, session: { select: { name: true } }, student: { select: { fatherName: true, rollNumber: true } } },
  });
  if (!receipt) notFound();
  const logo = await db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } });
  const logoUrl = schoolLogoUrl({ id: school.id, logo });
  // Consecutive instalments of the same fee become one line: "Tuition fee · Apr 2026 – Sep 2026 (6)".
  const lines: { key: string; name: string; period: string; amount: number }[] = [];
  let run: { first: string; last: string; count: number } | null = null;
  for (const item of receipt.items) {
    const prev = lines.at(-1);
    if (prev && prev.name === item.headName && run) {
      run.last = item.periodLabel;
      run.count++;
      prev.period = `${run.first} – ${run.last} (${run.count})`;
      prev.amount += item.amount;
    } else {
      run = { first: item.periodLabel, last: item.periodLabel, count: 1 };
      lines.push({ key: item.id, name: item.headName, period: item.periodLabel, amount: item.amount });
    }
  }
  // Two copies share an A4 page; a long receipt prints as one copy instead.
  const fitsTwo = lines.length <= 7;
  const copies = sp.copies === "1" || (!fitsTwo && sp.copies !== "2") ? ["Receipt"] : ["Parent copy", "Office copy"];

  const copy = (label: string) => (
    <article key={label} className={`relative flex ${copies.length === 2 ? "h-[128mm]" : "min-h-[128mm]"} flex-col overflow-hidden border border-slate-300 p-[7mm] text-[9.5pt] text-slate-900 [print-color-adjust:exact]`}>
      {receipt.cancelledAt && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-4 border-rose-500/60 px-6 py-2 text-[28pt] font-black uppercase tracking-widest text-rose-500/50">
          Cancelled
        </span>
      )}
      <header className="flex items-start gap-3 border-b border-slate-300 pb-[3mm]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-[14mm] w-[14mm] object-contain" />
        ) : (
          <span className="flex h-[14mm] w-[14mm] items-center justify-center rounded-full bg-slate-100">
            <GraduationCap className="h-[8mm] w-[8mm] text-slate-500" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13pt] font-bold uppercase leading-tight">{school.name}</p>
          {school.address && <p className="text-[8pt] leading-snug text-slate-600">{school.address.replace(/\n/g, ", ")}</p>}
          <p className="text-[8pt] text-slate-600">{[school.phone, school.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right">
          <p className="rounded bg-slate-900 px-2 py-0.5 text-[8pt] font-semibold uppercase tracking-wider text-white">Fee receipt</p>
          <p className="mt-1 text-[7.5pt] uppercase tracking-wider text-slate-500">{label}</p>
        </div>
      </header>

      <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-[1mm] py-[3mm] text-[9pt]">
        <dt className="text-slate-500">Receipt no.</dt>
        <dd className="font-mono font-semibold">{receipt.number}</dd>
        <dt className="text-slate-500">Date</dt>
        <dd className="font-semibold">{dateFmt.format(receipt.date)}</dd>
        <dt className="text-slate-500">Student</dt>
        <dd className="font-semibold">{receipt.studentName}</dd>
        <dt className="text-slate-500">Student ID</dt>
        <dd className="font-mono">{receipt.studentCode}</dd>
        <dt className="text-slate-500">Class</dt>
        <dd>
          {receipt.className ?? "—"}
          {receipt.student?.rollNumber != null && ` · Roll ${receipt.student.rollNumber}`}
        </dd>
        <dt className="text-slate-500">Father</dt>
        <dd>{receipt.student?.fatherName ?? "—"}</dd>
      </dl>

      <table className="w-full border-collapse text-[9pt]">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left">
            <th className="w-8 py-[1.2mm] pl-1 font-semibold">#</th>
            <th className="py-[1.2mm] font-semibold">Fee</th>
            <th className="py-[1.2mm] font-semibold">Period</th>
            <th className="py-[1.2mm] pr-1 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((item, i) => (
            <tr key={item.key} className="border-b border-slate-200">
              <td className="py-[1mm] pl-1 text-slate-500">{i + 1}</td>
              <td className="py-[1mm]">{item.name}</td>
              <td className="py-[1mm]">{item.period}</td>
              <td className="py-[1mm] pr-1 text-right tabular-nums">{rupees(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-b-2 border-slate-400">
            <td colSpan={3} className="py-[1.5mm] pl-1 text-right font-semibold">
              Total
            </td>
            <td className="py-[1.5mm] pr-1 text-right text-[11pt] font-bold tabular-nums">{rupees(receipt.total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-[2mm] text-[8.5pt] italic">{amountInWords(receipt.total)}</p>

      <div className="mt-auto flex items-end justify-between gap-4 pt-[3mm] text-[8.5pt]">
        <div className="space-y-[0.5mm]">
          <p>
            <span className="text-slate-500">Paid by:</span> {MODE_LABELS[receipt.mode]}
            {receipt.reference && ` · ${receipt.reference}`}
          </p>
          {receipt.remarks && (
            <p>
              <span className="text-slate-500">Remarks:</span> {receipt.remarks}
            </p>
          )}
          <p>
            <span className="text-slate-500">Received by:</span> {receipt.collectedBy}
          </p>
          {receipt.cancelledAt && (
            <p className="font-semibold text-rose-600">
              Cancelled {stamp.format(receipt.cancelledAt)} by {receipt.cancelledBy}: {receipt.cancelReason}
            </p>
          )}
          <p className="text-[7pt] text-slate-400">Computer-generated receipt · Session {receipt.session.name}</p>
        </div>
        <div className="w-[40mm] border-t border-slate-400 pt-[1mm] text-center text-[8pt] text-slate-500">Signature</div>
      </div>
    </article>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4 print:hidden">
        {sp.new === "1" && !receipt.cancelledAt && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <CircleCheck className="h-4 w-4" /> Payment of {rupees(receipt.total)} saved. Receipt {receipt.number}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          {(fitsTwo || copies.length === 2) && (
            <Link href={`?copies=${copies.length === 2 ? "1" : "2"}${sp.new === "1" ? "&new=1" : ""}`} className={buttonVariants.secondary}>
              {copies.length === 2 ? "Print one copy instead" : "Print parent + office copies"}
            </Link>
          )}
          {receipt.studentId && (
            <Link href={`/admin/fees/students/${receipt.studentId}`} className={buttonVariants.ghost}>
              Back to {receipt.studentName.split(" ")[0]}&apos;s fees
            </Link>
          )}
        </div>
      </div>

      <style>{`@page { size: A4 portrait; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mx-auto w-full max-w-[190mm] space-y-[4mm] bg-white print:max-w-none">
        {copies.map((label, i) => (
          <div key={label}>
            {i > 0 && <div className="mb-[4mm] border-t border-dashed border-slate-400 text-center text-[7pt] text-slate-400 print:block" />}
            {copy(label)}
          </div>
        ))}
      </div>

      {canManage && !receipt.cancelledAt && (
        <Card title="Cancel this receipt" icon={XCircle} className="max-w-xl print:hidden">
          <p className="mb-3 text-sm text-slate-600">Use this if the payment was entered by mistake or the cheque bounced. The receipt is kept and marked cancelled, and its amounts become due again.</p>
          <ActionForm action={cancelReceipt.bind(null, receipt.id)} className="space-y-3">
            <Field label="Reason" name="reason" required>
              <input name="reason" maxLength={200} required className={inputClass} />
            </Field>
            <SubmitButton variant="danger" confirm={`Cancel receipt ${receipt.number}?`}>
              Cancel receipt
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
