import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, loadStudentAccount } from "@/lib/fees";
import { MODE_LABELS, billOf, deskMonths, dueKey } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";
import { schoolLogoUrl } from "@/lib/school";
import { quickCollect } from "../../actions";
import { FeeBill } from "./fee-bill";

/**
 * A month's fee bill, opened from the Fee desk. It reads like the receipt it
 * becomes: the month's fees, their due date, any late fee and the total. Each
 * month is billed and collected on its own; collecting opens the receipt.
 */
export default async function FeeBillPage({ params }: PageProps<"/admin/fee-desk/[id]/[month]">) {
  const { id, month } = await params;
  const { school } = await getFeesAccess();
  const account = await loadStudentAccount(school.id, id);
  if (!account) notFound();
  const { student, session, today } = account;
  const months = deskMonths(account.dues, session.startDate.toISOString().slice(0, 10), today);
  const at = months.findIndex((m) => m.key === month);
  if (at < 0) notFound();
  const bill = months[at];
  // Part-paid months before this one whose balance is collected here, or where this one's went.
  const { carried, movedTo } = billOf(months, bill.key)!;
  const nextBill = months.slice(at + 1).find((m) => m.items.length > 0);

  const [logo, receiptItems] = await Promise.all([
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
    bill.items.length
      ? db.feeReceiptItem.findMany({
          where: { receipt: { schoolId: school.id, studentId: student.id, cancelledAt: null }, OR: bill.items.map((d) => ({ headId: d.headId, period: d.period })) },
          orderBy: { receipt: { date: "asc" } },
          select: { receipt: { select: { id: true, number: true, date: true, mode: true } } },
        })
      : [],
  ]);
  const receipts = [...new Map(receiptItems.map((i) => [i.receipt.id, i.receipt])).values()];
  const name = fullName(student);
  const deskHref = `/admin/fee-desk?s=${student.id}`;
  const prev = months[at - 1]?.key !== "arrears" ? months[at - 1] : undefined;
  const next = months[at + 1];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={deskHref} className={buttonVariants.ghost}>
          <ArrowLeft className="h-4 w-4" /> {name}
        </Link>
        <span className="ml-auto flex items-center gap-1">
          {prev && (
            <Link href={`/admin/fee-desk/${student.id}/${prev.key}`} className={buttonVariants.ghost} aria-label={prev.label}>
              <ChevronLeft className="h-4 w-4" /> {prev.label.split(" ")[0]}
            </Link>
          )}
          {next && (
            <Link href={`/admin/fee-desk/${student.id}/${next.key}`} className={buttonVariants.ghost} aria-label={next.label}>
              {next.label.split(" ")[0]} <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </span>
      </div>

      <FeeBill
        // A fresh bill (late fee ticks, discount) whenever the dues change.
        key={[...carried.flatMap((c) => c.items), ...bill.items].map((d) => `${dueKey(d.headId, d.period)}:${d.balance}`).join(",")}
        data={{
          school: { name: school.name, address: school.address, phone: school.phone, logoUrl: schoolLogoUrl({ id: school.id, logo }) },
          student: {
            name,
            className: student.section ? sectionLabel(student.section) : "—",
            code: student.studentCode,
            father: student.fatherName ?? "—",
            roll: student.rollNumber != null ? String(student.rollNumber) : "—",
            active: student.status === "ACTIVE",
          },
          month: { key: bill.key, label: bill.label, items: bill.items, charged: bill.charged, balance: bill.balance },
          carried: carried.map((c) => ({ key: c.key, label: c.label, items: c.items, balance: c.balance })),
          movedTo: movedTo && { key: movedTo.key, label: movedTo.label },
          nextBill: nextBill ? { key: nextBill.key, label: nextBill.label } : null,
          receipts: receipts.map((r) => ({ id: r.id, number: r.number, date: r.date.toISOString().slice(0, 10), mode: MODE_LABELS[r.mode] })),
        }}
        today={today}
        minDate={session.startDate.toISOString().slice(0, 10)}
        action={quickCollect.bind(null, student.id)}
      />
    </div>
  );
}
