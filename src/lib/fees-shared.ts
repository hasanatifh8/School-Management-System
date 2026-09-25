// Fee schedules and dues. No server-only imports, so client components can use it.

export const FREQUENCIES = ["ONE_TIME", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_META: Record<Frequency, { label: string; short: string; hint: string; periods: number }> = {
  ONE_TIME: { label: "One time", short: "One time", hint: "Charged once, to students admitted this session (e.g. admission fee).", periods: 1 },
  MONTHLY: { label: "Monthly", short: "Monthly", hint: "Every month of the session (12 instalments).", periods: 12 },
  QUARTERLY: { label: "Quarterly", short: "Quarterly", hint: "Every 3 months: Apr, Jul, Oct, Jan.", periods: 4 },
  HALF_YEARLY: { label: "Half-yearly", short: "Half-yearly", hint: "Twice a session: Apr and Oct.", periods: 2 },
  YEARLY: { label: "Once a year / extra due", short: "Yearly", hint: "Once in the session, in the month you choose (annual charges, exam fee, event fee…).", periods: 1 },
};

export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "CHEQUE", "BANK_TRANSFER", "OTHER"] as const;
export type PaymentModeKey = (typeof PAYMENT_MODES)[number];
export const MODE_LABELS: Record<PaymentModeKey, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  CHEQUE: "Cheque",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const rupees = (n: number) => inr.format(n);

/* ───────────────────────── Periods ───────────────────────── */

export type Period = { key: string; label: string; start: string; end: string; due: string };

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
/** Session month `i` (0 = the first month, April) → [year, month index]. */
function sessionMonth(sessionStart: string, i: number) {
  const [y, m] = sessionStart.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + i, 1));
  return [d.getUTCFullYear(), d.getUTCMonth()] as const;
}
function span(sessionStart: string, from: number, months: number, dueDay: number) {
  const [y1, m1] = sessionMonth(sessionStart, from);
  const [y2, m2] = sessionMonth(sessionStart, from + months - 1);
  return { start: iso(y1, m1, 1), end: iso(y2, m2, lastDay(y2, m2)), due: iso(y1, m1, Math.min(dueDay, lastDay(y1, m1))) };
}

/** The instalments of a fee head in a session (sessionStart = "2026-04-01"). */
export function feePeriods(
  head: { frequency: Frequency; dueDay: number; dueMonth: number | null },
  sessionStart: string,
  sessionName: string,
): Period[] {
  const { frequency, dueDay } = head;
  switch (frequency) {
    case "MONTHLY":
      return Array.from({ length: 12 }, (_, i) => {
        const [y, m] = sessionMonth(sessionStart, i);
        return { key: iso(y, m, 1).slice(0, 7), label: `${MONTH_NAMES[m]} ${y}`, ...span(sessionStart, i, 1, dueDay) };
      });
    case "QUARTERLY":
      return [0, 1, 2, 3].map((q) => {
        const [, a] = sessionMonth(sessionStart, q * 3);
        const [, b] = sessionMonth(sessionStart, q * 3 + 2);
        return { key: `Q${q + 1}`, label: `Q${q + 1} · ${MONTH_NAMES[a]}–${MONTH_NAMES[b]}`, ...span(sessionStart, q * 3, 3, dueDay) };
      });
    case "HALF_YEARLY":
      return [0, 1].map((h) => {
        const [, a] = sessionMonth(sessionStart, h * 6);
        const [, b] = sessionMonth(sessionStart, h * 6 + 5);
        return { key: `H${h + 1}`, label: `${MONTH_NAMES[a]}–${MONTH_NAMES[b]}`, ...span(sessionStart, h * 6, 6, dueDay) };
      });
    case "YEARLY": {
      // The chosen calendar month, placed inside the session (Apr–Mar).
      const startMonth = Number(sessionStart.slice(5, 7)) - 1;
      const offset = ((head.dueMonth ?? startMonth + 1) - 1 - startMonth + 12) % 12;
      const whole = span(sessionStart, 0, 12, dueDay);
      return [{ key: "Y", label: sessionName, start: whole.start, end: whole.end, due: span(sessionStart, offset, 1, dueDay).due }];
    }
    case "ONE_TIME": {
      const whole = span(sessionStart, 0, 12, dueDay);
      return [{ key: "ONCE", label: "One time", start: whole.start, end: whole.end, due: whole.start }];
    }
  }
}

/* ───────────────────────── Dues ───────────────────────── */

export type FeeHeadInfo = {
  id: string;
  name: string;
  frequency: Frequency;
  optional: boolean;
  dueDay: number;
  dueMonth: number | null;
  amounts: Record<string, number>; // classId → rupees
};

export type DueStatus = "PAID" | "PARTIAL" | "OVERDUE" | "UPCOMING";

export type DueItem = {
  headId: string;
  headName: string;
  frequency: Frequency;
  period: string;
  label: string;
  due: string;
  amount: number;
  paid: number;
  balance: number;
  status: DueStatus;
};

export const dueKey = (headId: string, period: string) => `${headId}|${period}`;

/**
 * Everything a student is charged this session, instalment by instalment.
 * - Heads without an amount for the student's class don't apply.
 * - Optional heads apply only if the student was added to them.
 * - One-time heads apply only to students admitted during this session.
 * - Instalments that ended before the student was admitted are skipped.
 */
export function studentDues({
  heads,
  classId,
  admissionDate,
  optIns,
  paid,
  session,
  today,
}: {
  heads: FeeHeadInfo[];
  classId: string | null;
  admissionDate: string; // ISO date
  optIns: Set<string>;
  paid: Map<string, number>; // dueKey → rupees
  session: { start: string; name: string };
  today: string;
}): DueItem[] {
  const items: DueItem[] = [];
  for (const head of heads) {
    const amount = classId ? head.amounts[classId] : undefined;
    // Anything already paid still shows, even if the head no longer applies.
    const applies = amount != null && amount > 0 && (!head.optional || optIns.has(head.id));
    for (const p of feePeriods(head, session.start, session.name)) {
      const paidSoFar = paid.get(dueKey(head.id, p.key)) ?? 0;
      const charged =
        applies && (head.frequency !== "ONE_TIME" || admissionDate >= session.start) && p.end >= admissionDate;
      if (!charged && !paidSoFar) continue;
      const due = charged ? amount! : paidSoFar;
      const balance = Math.max(0, due - paidSoFar);
      items.push({
        headId: head.id,
        headName: head.name,
        frequency: head.frequency,
        period: p.key,
        label: p.label,
        due: p.due,
        amount: due,
        paid: paidSoFar,
        balance,
        status: balance === 0 ? "PAID" : paidSoFar > 0 ? "PARTIAL" : p.due <= today ? "OVERDUE" : "UPCOMING",
      });
    }
  }
  return items.sort((a, b) => a.due.localeCompare(b.due) || a.headName.localeCompare(b.headName));
}

export function dueTotals(items: DueItem[], today: string) {
  let total = 0;
  let paid = 0;
  let dueNow = 0;
  let upcoming = 0;
  for (const i of items) {
    total += i.amount;
    paid += i.paid;
    if (i.due <= today) dueNow += i.balance;
    else upcoming += i.balance;
  }
  return { total, paid, dueNow, upcoming };
}

/* ───────────────────────── Amount in words (Indian system) ───────────────────────── */

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
function belowThousand(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** 125050 → "Rupees One Lakh Twenty Five Thousand Fifty Only" */
export function amountInWords(n: number) {
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return `Rupees ${parts.join(" ")} Only`;
}
