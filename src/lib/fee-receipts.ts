import "server-only";
// Saving a fee payment as a numbered receipt: shared by the detailed collect
// form and the Fee desk, so both number, check and annotate receipts alike.
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import type { PaymentModeKey } from "@/lib/fees-shared";
import { dueKey, monthLabel, rupees, type DueItem } from "@/lib/fees-shared";
import { type getFeesAccess, type loadStudentAccount, nextReceiptNumber } from "@/lib/fees";
import { fullName, sectionLabel } from "@/lib/queries";

type Account = NonNullable<Awaited<ReturnType<typeof loadStudentAccount>>>;
type Access = Awaited<ReturnType<typeof getFeesAccess>>;

export type ReceiptLine = { headId: string; headName: string; period: string; periodLabel: string; amount: number; discount: number; lateFee: number; charged: number };

/** One receipt line for an instalment. */
export function receiptLine(item: DueItem, amount: number, discount: number, lateFee: number): ReceiptLine {
  return {
    headId: item.headId,
    headName: item.headName,
    period: item.period,
    // Months before admission are marked as such on the receipt.
    periodLabel: item.beforeAdmission ? `${item.label} · before admission` : item.label,
    amount,
    discount,
    lateFee,
    // The instalment keeps this price from now on (a later fee or class change won't reprice it).
    charged: item.amount,
  };
}

/**
 * Creates the receipt. Inside a serializable transaction it re-checks what is
 * already paid, so two counters (or tabs) can't collect the same instalments.
 */
export async function saveReceipt({
  access,
  account,
  lines,
  date,
  mode,
  reference,
  remarks,
  discountNote,
  lateWaived,
}: {
  access: Access;
  account: Account;
  lines: ReceiptLine[];
  date: string;
  mode: PaymentModeKey;
  reference: string | null;
  remarks: string | null;
  discountNote: string | null;
  lateWaived: number;
}): Promise<{ id: string; number: string } | { error: string }> {
  const { school, session, who } = access;
  const { student } = account;
  const byKey = new Map(account.dues.map((d) => [dueKey(d.headId, d.period), d]));
  // A waived late fee is noted on the receipt, so the waiver can be traced.
  const note = lateWaived ? `Late fee ${rupees(lateWaived)} waived by ${who}` : null;
  try {
    return await db.$transaction(
      async (tx) => {
        const fresh = await tx.feeReceiptItem.groupBy({
          by: ["headId", "period"],
          where: { receipt: { studentId: student.id, cancelledAt: null }, OR: lines.map((l) => ({ headId: l.headId, period: l.period })) },
          _sum: { amount: true, discount: true, lateFee: true },
        });
        const now = new Map(fresh.map((f) => [dueKey(f.headId!, f.period), f._sum]));
        for (const l of lines) {
          const item = byKey.get(dueKey(l.headId, l.period))!;
          const f = now.get(dueKey(l.headId, l.period));
          if ((f?.amount ?? 0) + (f?.discount ?? 0) !== item.paid + item.discount || (f?.lateFee ?? 0) !== item.lateFeePaid) throw new PaymentChanged();
        }
        return tx.feeReceipt.create({
          data: {
            schoolId: school.id,
            sessionId: session.id,
            studentId: student.id,
            number: await nextReceiptNumber(tx, school.id, session.name),
            date: parseISODate(date)!,
            mode,
            reference,
            remarks: [remarks, note].filter(Boolean).join(" · ") || null,
            discountNote,
            feeNote: admissionFeeNote(account),
            total: lines.reduce((n, l) => n + l.amount + l.lateFee, 0),
            studentName: fullName(student),
            studentCode: student.studentCode,
            className: student.section ? sectionLabel(student.section) : null,
            collectedBy: who,
            items: { create: lines },
          },
          select: { id: true, number: true },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    // Serializable conflicts (P2034) mean another payment was saved at the same moment.
    if (e instanceof PaymentChanged || (e as { code?: string }).code === "P2034") {
      return { error: "A payment for this student was just recorded elsewhere. Reload to see the latest dues before collecting." };
    }
    throw e;
  }
}

/**
 * For a student admitted after the session began: how the months before
 * admission were handled, as printed on the receipt.
 */
export function admissionFeeNote(account: Account) {
  const { student, session, heads } = account;
  const admitted = student.admissionDate.toISOString().slice(0, 10);
  const start = session.startDate.toISOString().slice(0, 10);
  if (admitted.slice(0, 7) <= start.slice(0, 7) || admitted > session.endDate.toISOString().slice(0, 10)) return null;
  const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(student.admissionDate);
  const from = student.feesFrom?.toISOString().slice(0, 10);
  // Opt-in fees (e.g. transport) set to start before admission are charged as chosen.
  const optEarly = account.optionalHeads
    .filter((o) => o.added && o.from && o.from < admitted.slice(0, 7))
    .map((o) => `${o.name} charged from ${monthLabel(o.from!)}`);
  const extra = optEarly.length ? ` ${optEarly.join("; ")}.` : "";
  if (!from || from.slice(0, 7) >= admitted.slice(0, 7)) return `Admitted ${when}. ${optEarly.length ? "Other fees" : "Fees"} before admission are not charged.${extra}`;
  const picked = student.feesFromHeadIds.length ? heads.filter((h) => student.feesFromHeadIds.includes(h.id)).map((h) => h.name) : [];
  return `Admitted ${when}. Fees before admission charged from ${monthLabel(from.slice(0, 7))}${picked.length ? ` for ${picked.join(", ")} only` : " for all fees"}.${extra}`;
}

/** The student's dues changed between loading the form and saving the payment. */
class PaymentChanged extends Error {}
