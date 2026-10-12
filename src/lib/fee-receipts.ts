import "server-only";
// Saving a fee payment as a numbered receipt: shared by the detailed collect
// form and the Fee desk, so both number, check and annotate receipts alike.
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import type { PaymentModeKey } from "@/lib/fees-shared";
import { deskMonth, dueKey, lateLeftIn, monthLabel, type BillLine } from "@/lib/fees-shared";
import { type getFeesAccess, type loadStudentAccount, nextReceiptNumber } from "@/lib/fees";
import { fullName, sectionLabel } from "@/lib/queries";

type Account = NonNullable<Awaited<ReturnType<typeof loadStudentAccount>>>;
type Access = Awaited<ReturnType<typeof getFeesAccess>>;

export type ReceiptLine = {
  headId: string;
  headName: string;
  period: string;
  periodLabel: string;
  amount: number;
  discount: number;
  lateFee: number;
  charged: number;
  lateCharged: number;
  lateWaived: number;
  lateMonths: number;
  month: string;
  lateMonth: string | null;
  paidBefore: number;
  cleared: boolean;
};

/**
 * A receipt line from what a payment does to an instalment for one month's
 * bill: its fee and own late fee, or (a later month) that month's late fee on
 * it, kept apart so each month's bill and receipt show only their own fines.
 */
export function receiptLine(l: BillLine): ReceiptLine {
  const { item } = l;
  const own = l.month === deskMonth(item);
  return {
    headId: item.headId,
    headName: item.headName,
    period: item.period,
    // Months before admission are marked as such on the receipt.
    periodLabel: item.beforeAdmission ? `${item.label} · before admission` : item.label,
    amount: l.amount,
    discount: l.discount,
    lateFee: l.lateFee,
    lateCharged: l.lateCharged,
    lateWaived: l.lateWaived,
    lateMonths: l.lateMonths,
    // The bill the line belongs to; a later month's late fee says which month it is.
    month: l.month,
    lateMonth: own ? null : l.month,
    // What was paid on the instalment before, and whether this settles its own month: the
    // receipt and the month's bill say "clears May 2026 (₹2,000 paid earlier)".
    paidBefore: own ? item.paid + item.discount + (item.lateBy[""]?.paid ?? 0) : 0,
    cleared: own && l.amount + l.discount >= item.balance && l.lateFee + l.lateWaived >= lateLeftIn(item, l.month) + l.lateCharged,
    // The instalment keeps this price from now on (a later fee or class change won't reprice it).
    charged: own ? item.amount : 0,
  };
}

type Common = {
  access: Access;
  account: Account;
  date: string;
  mode: PaymentModeKey;
  reference: string | null;
  remarks: string | null;
};

export type ReceiptDraft = {
  lines: ReceiptLine[];
  discountNote: string | null;
  lateWaived: number;
  /** Dues written off by an admin, not a payment: numbered apart, total 0. */
  waiver?: boolean;
  /**
   * Fee desk: the bill it settles, what it left owing and the bill that moved to (null = the same),
   * and for an add-on receipt (an earlier month's balance) the later bill it was collected at.
   */
  bill?: { month: string; leftOwing: number; leftTo: string | null; collectedOn?: string | null };
};

/** Creates the receipt (see saveReceipts). */
export async function saveReceipt({ access, account, date, mode, reference, remarks, ...draft }: Common & ReceiptDraft): Promise<{ id: string; number: string } | { error: string }> {
  const saved = await saveReceipts({ access, account, date, mode, reference, remarks }, [draft]);
  return "error" in saved ? saved : saved[0];
}

/**
 * Creates one or more receipts for one payment, in order, all or none (the Fee
 * desk settles each earlier month's previous dues on its own receipt before the
 * month's own). Inside a serializable transaction it re-checks what is already
 * paid, so two counters (or tabs) can't collect the same instalments.
 */
export async function saveReceipts(
  { access, account, date, mode, reference, remarks }: Common,
  drafts: ReceiptDraft[],
): Promise<{ id: string; number: string }[] | { error: string }> {
  const { school, session, who } = access;
  const { student } = account;
  const byKey = new Map(account.dues.map((d) => [dueKey(d.headId, d.period), d]));
  const lines = drafts.flatMap((d) => d.lines);
  try {
    return await db.$transaction(
      async (tx) => {
        const fresh = await tx.feeReceiptItem.groupBy({
          by: ["headId", "period"],
          where: { receipt: { studentId: student.id, cancelledAt: null }, OR: lines.map((l) => ({ headId: l.headId, period: l.period })) },
          _sum: { amount: true, discount: true, lateFee: true, lateCharged: true, lateWaived: true },
        });
        const now = new Map(fresh.map((f) => [dueKey(f.headId!, f.period), f._sum]));
        for (const l of lines) {
          const item = byKey.get(dueKey(l.headId, l.period))!;
          const f = now.get(dueKey(l.headId, l.period));
          if (
            (f?.amount ?? 0) + (f?.discount ?? 0) !== item.paid + item.discount ||
            (f?.lateFee ?? 0) !== item.lateFeePaid ||
            (f?.lateCharged ?? 0) !== item.lateCharged ||
            (f?.lateWaived ?? 0) !== item.lateCharged - item.lateFeePaid - item.lateLeft
          )
            throw new PaymentChanged();
        }
        const out: { id: string; number: string }[] = [];
        // A millisecond apart, so receipts made together keep their order (and "paid earlier" counts the first).
        const at = Date.now();
        for (const [i, { lines, discountNote, lateWaived, waiver = false, bill }] of drafts.entries()) {
          out.push(
            await tx.feeReceipt.create({
              data: {
                schoolId: school.id,
                sessionId: session.id,
                studentId: student.id,
                number: await nextReceiptNumber(tx, school.id, session.name, waiver),
                waiver,
                billMonth: bill?.month ?? null,
                leftOwing: bill?.leftOwing ?? 0,
                leftTo: bill?.leftTo ?? null,
                collectedOn: bill?.collectedOn ?? null,
                date: parseISODate(date)!,
                mode,
                reference,
                remarks,
                // A waived late fee is recorded, so the waiver shows on the receipt and the ledger.
                lateWaived,
                discountNote,
                feeNote: admissionFeeNote(account),
                total: lines.reduce((n, l) => n + l.amount + l.lateFee, 0),
                studentName: fullName(student),
                studentCode: student.studentCode,
                className: student.section ? sectionLabel(student.section) : null,
                collectedBy: who,
                createdAt: new Date(at + i),
                items: { create: lines },
              },
              select: { id: true, number: true },
            }),
          );
        }
        return out;
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
