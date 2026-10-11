// How a fee receipt reads: its lines, grouped by bill, and what it did to the
// bill. Shared by the receipt page and its PDF so both say the same.
import { monthLabel, rupees } from "@/lib/fees-shared";

type Item = {
  id: string;
  headName: string;
  periodLabel: string;
  amount: number;
  discount: number;
  lateFee: number;
  charged: number;
  month: string | null;
  paidBefore: number;
  cleared: boolean;
};
type Receipt = { billMonth: string | null; leftOwing: number; leftTo: string | null; waiver: boolean; cancelledAt: Date | null; items: Item[] };

export type ReceiptRow =
  | { kind: "section"; key: string; label: string }
  | { kind: "fee"; key: string; name: string; period: string; note?: string; amount: number }
  | { kind: "late"; key: string; name: string; period: string; amount: number };

const billLabel = (month: string) => (month === "arrears" ? "last session's dues" : monthLabel(month));

/**
 * The receipt's lines. One collected on a Fee desk bill is split into the
 * previous dues it paid (each saying whether it clears that month, and what was
 * paid on it before) and the bill's own fees, each late fee on its own line by
 * month. Other receipts list fees as before: runs of months become one line.
 */
export function receiptRows(receipt: Receipt): ReceiptRow[] {
  const { billMonth } = receipt;
  if (!billMonth) return flatRows(receipt.items);
  const previous = receipt.items.filter((i) => i.month && i.month !== billMonth);
  const own = receipt.items.filter((i) => !i.month || i.month === billMonth);
  const rows = (items: Item[]) => items.flatMap((i) => itemRows(i, i.month !== billMonth));
  if (!previous.length) return rows(own);
  return [
    { kind: "section", key: "previous", label: "Previous dues" },
    ...rows(previous),
    ...(own.some((i) => i.amount + i.discount + i.lateFee > 0) ? [{ kind: "section" as const, key: "own", label: `${billLabel(billMonth)} fees` }, ...rows(own)] : []),
  ];
}

function itemRows(i: Item, earlier: boolean): ReceiptRow[] {
  const out: ReceiptRow[] = [];
  const fee = i.amount + i.discount;
  if (fee > 0) {
    const note = i.cleared
      ? earlier || i.paidBefore > 0
        ? `balance, clears it${i.paidBefore > 0 ? ` (${rupees(i.paidBefore)} paid earlier)` : ""}`
        : undefined
      : i.charged > fee
        ? `part of ${rupees(i.charged)}`
        : undefined;
    out.push({ kind: "fee", key: i.id, name: i.headName, period: i.periodLabel, note, amount: fee });
  }
  if (i.lateFee > 0) {
    // A late fee paid on its own (the fee was paid earlier) says when the instalment cleared.
    out.push({ kind: "late", key: `${i.id}:late`, name: "Late fee", period: `${i.headName} · ${i.periodLabel}${fee === 0 && i.cleared ? " · clears it" : ""}`, amount: i.lateFee });
  }
  return out;
}

/** Receipts not taken on a Fee desk bill: consecutive instalments of a fee as one line, late fees as one. */
function flatRows(items: Item[]): ReceiptRow[] {
  const rows: (ReceiptRow & { kind: "fee" })[] = [];
  let run: { first: string; last: string; count: number } | null = null;
  const isPart = (i: Item) => i.charged > 0 && i.amount + i.discount < i.charged;
  // A line that only pays (or waives) a late fee shows in the late fee line.
  for (const item of items.filter((i) => i.amount + i.discount > 0)) {
    const prev = rows.at(-1);
    if (prev && prev.name === item.headName && run && !isPart(item) && !prev.note) {
      run.last = item.periodLabel;
      run.count++;
      prev.period = `${run.first} – ${run.last} (${run.count})`;
      prev.amount += item.amount + item.discount;
    } else {
      run = { first: item.periodLabel, last: item.periodLabel, count: 1 };
      rows.push({ kind: "fee", key: item.id, name: item.headName, period: item.periodLabel, note: isPart(item) ? `part of ${rupees(item.charged)}` : undefined, amount: item.amount + item.discount });
    }
  }
  const late = items.filter((i) => i.lateFee > 0);
  const lateFee = late.reduce((n, i) => n + i.lateFee, 0);
  return lateFee ? [...rows, { kind: "late", key: "late", name: "Late fee", period: `${late.length} late instalment${late.length === 1 ? "" : "s"}`, amount: lateFee }] : rows;
}

/**
 * What the receipt did to its Fee desk bill, in a sentence or two: "June 2026
 * bill paid in full. Clears May 2026 (Tuition Fees)." or "₹100 left moves to
 * the July 2026 bill as previous dues." Null for other receipts.
 */
export function billStatusNote(receipt: Receipt): string | null {
  const { billMonth } = receipt;
  if (!billMonth || receipt.waiver) return null;
  const cleared = [...new Set(receipt.items.filter((i) => i.cleared && i.month && i.month !== billMonth).map((i) => i.month!))];
  const clears = cleared.length
    ? ` Clears ${cleared
        .map((m) => `${billLabel(m)} (${[...new Set(receipt.items.filter((i) => i.month === m && i.cleared).map((i) => i.headName))].join(", ")})`)
        .join(", ")}.`
    : "";
  if (receipt.leftOwing > 0) {
    const where = receipt.leftTo ? `moves to the ${billLabel(receipt.leftTo)} bill as previous dues` : `stays due on the ${billLabel(billMonth)} bill`;
    return `Part payment of the ${billLabel(billMonth)} bill: ${rupees(receipt.leftOwing)} left ${where}.${clears}`;
  }
  return `${billLabel(billMonth)} bill paid in full.${clears}`;
}
