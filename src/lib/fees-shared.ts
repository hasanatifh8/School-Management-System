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
  /** Extra charge, once per instalment, when it is paid after its due date. */
  lateFee: number;
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
  /** Waived off when collecting; counts as settled. */
  discount: number;
  balance: number;
  status: DueStatus;
  /** Late fee owed as of today: unpaid past `lateAfter`, and no late fee taken yet. */
  lateFee: number;
  /** The head's late fee, if one can still be charged on this instalment (0 if none or already paid). */
  lateFeeRate: number;
  /** Late if paid after this day: the due date, or the admission date for a student who joined later. */
  lateAfter: string;
  /** Late fee already collected on this instalment. */
  lateFeePaid: number;
  /** A month before the student's admission, charged because fees staff chose to. */
  beforeAdmission: boolean;
  /** Left unpaid from an earlier session (its name), carried into this one. */
  arrears: string | null;
};

export const dueKey = (headId: string, period: string) => `${headId}|${period}`;

/**
 * Everything a student is charged in a session, instalment by instalment.
 * - Heads without an amount for the student's class don't apply.
 * - Optional heads apply only if the student was added to them, from the month
 *   they were added (`optIns` maps head → first day charged, null = whole session).
 *   A start month earlier than admission is honoured as chosen.
 * - A one-time fee for a mid-session admission falls due on the admission date.
 * - One-time heads apply only to students admitted during this session.
 * - Instalments that ended before the student was admitted are skipped, unless
 *   fees staff chose to charge from an earlier month (`chargeFrom`), and then
 *   only for the fees they picked (`backHeadIds`, empty = every fee).
 * - An instalment that already has a payment keeps the price it was paid at
 *   (`priced`), so a later class change or fee change doesn't reprice it.
 */
export function studentDues({
  heads,
  classId,
  admissionDate,
  chargeFrom,
  backHeadIds = [],
  optIns,
  paid,
  discounts = new Map(),
  lateFeesPaid = new Map(),
  priced = new Map(),
  session,
  today,
}: {
  heads: FeeHeadInfo[];
  classId: string | null;
  admissionDate: string; // ISO date
  /** First day fees are charged from, when set earlier (or later) than admission. */
  chargeFrom?: string | null;
  /** Fees charged for the months before admission; empty = all of them. */
  backHeadIds?: string[];
  optIns: Map<string, string | null>;
  paid: Map<string, number>; // dueKey → rupees
  discounts?: Map<string, number>; // dueKey → rupees waived
  lateFeesPaid?: Map<string, number>; // dueKey → late fee collected
  priced?: Map<string, number>; // dueKey → instalment amount when it was paid
  session: { start: string; name: string };
  today: string;
}): DueItem[] {
  const items: DueItem[] = [];
  const start = chargeFrom ?? admissionDate;
  for (const head of heads) {
    const amount = classId ? head.amounts[classId] : undefined;
    // Anything already paid still shows, even if the head no longer applies.
    const applies = amount != null && amount > 0 && (!head.optional || optIns.has(head.id));
    const optFrom = head.optional ? (optIns.get(head.id) ?? null) : null;
    // An opt-in fee started before admission was set that way on purpose: it overrides the admission rule.
    const optOverride = !!optFrom && optFrom < admissionDate;
    const backOk = !backHeadIds.length || backHeadIds.includes(head.id);
    for (const p of feePeriods(head, session.start, session.name)) {
      const k = dueKey(head.id, p.key);
      const paidSoFar = paid.get(k) ?? 0;
      const discount = discounts.get(k) ?? 0;
      const beforeAdmission = p.end < admissionDate;
      const charged =
        applies &&
        (head.frequency !== "ONE_TIME" || admissionDate >= session.start) &&
        (optOverride
          ? p.end >= optFrom!
          : p.end >= start && (!beforeAdmission || backOk) && (!optFrom || p.end >= optFrom));
      // A one-time fee (e.g. admission) falls due on the admission date for a mid-session admission.
      const dueOn = head.frequency === "ONE_TIME" && admissionDate > p.due ? admissionDate : p.due;
      if (!charged && !paidSoFar && !discount) continue;
      const due = charged ? priced.get(k) || amount! : paidSoFar + discount;
      const balance = Math.max(0, due - paidSoFar - discount);
      const lateFeePaid = lateFeesPaid.get(k) ?? 0;
      // Nobody is late for a month before they joined (even when charged for it): those
      // instalments fall late only after the first due day on or after admission.
      const lateAfter = p.due >= admissionDate ? p.due : firstDueOnOrAfter(admissionDate, head.dueDay);
      const lateFeeRate = charged && balance > 0 && head.lateFee > 0 && lateFeePaid === 0 ? head.lateFee : 0;
      items.push({
        headId: head.id,
        headName: head.name,
        frequency: head.frequency,
        period: p.key,
        label: p.label,
        due: dueOn,
        amount: due,
        paid: paidSoFar,
        discount,
        balance,
        status: balance === 0 ? "PAID" : paidSoFar + discount > 0 ? "PARTIAL" : dueOn <= today ? "OVERDUE" : "UPCOMING",
        // Charged once per instalment, only after the due date has passed.
        lateFee: today > lateAfter ? lateFeeRate : 0,
        lateFeeRate,
        lateAfter,
        lateFeePaid,
        beforeAdmission: beforeAdmission && head.frequency !== "ONE_TIME",
        arrears: null,
      });
    }
  }
  return items.sort((a, b) => a.due.localeCompare(b.due) || a.headName.localeCompare(b.headName));
}

/** The first `dueDay` of a month falling on or after `date` ("2026-07-20", 10 → "2026-08-10"). */
function firstDueOnOrAfter(date: string, dueDay: number) {
  const [y, m, d] = date.split("-").map(Number);
  const inMonth = (yy: number, mm: number) => iso(yy, mm, Math.min(dueDay, lastDay(yy, mm)));
  return d <= Math.min(dueDay, lastDay(y, m - 1)) ? inMonth(y, m - 1) : inMonth(m === 12 ? y + 1 : y, m === 12 ? 0 : m);
}

export function dueTotals(items: DueItem[], today: string) {
  let total = 0;
  let paid = 0;
  let discount = 0;
  let dueNow = 0;
  let upcoming = 0;
  for (const i of items) {
    total += i.amount;
    paid += i.paid;
    discount += i.discount;
    if (i.due <= today) dueNow += i.balance;
    else upcoming += i.balance;
  }
  return { total, paid, discount, dueNow, upcoming };
}

/* ───────────────────────── Dues for a target month ───────────────────────── */

const longMonth = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
/** "2026-10" → "October 2026" */
export const monthLabel = (month: string) => longMonth.format(new Date(`${month}-01T00:00:00Z`));

export type MonthDues = { month: string; label: string; items: DueItem[]; amount: number; lateFee: number; subtotal: number };

function groupMonths(items: DueItem[]): MonthDues[] {
  const map = new Map<string, MonthDues>();
  for (const d of items) {
    const month = d.due.slice(0, 7);
    const g = map.get(month) ?? { month, label: monthLabel(month), items: [], amount: 0, lateFee: 0, subtotal: 0 };
    g.items.push(d);
    g.amount += d.balance;
    g.lateFee += d.lateFee;
    g.subtotal += d.balance + d.lateFee;
    map.set(month, g);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Splits a student's unpaid instalments around a target month ("2026-10"):
 * the target month's demand (every fee falling due that month: monthly fees,
 * a quarter or half-year starting then, a yearly fee set for it), earlier
 * unpaid months, and later months that may be paid in advance.
 */
export function feeSummary(dues: DueItem[], targetMonth: string) {
  const open = dues.filter((d) => d.balance > 0);
  const current = open.filter((d) => d.due.slice(0, 7) === targetMonth);
  const previous = groupMonths(open.filter((d) => d.due.slice(0, 7) < targetMonth));
  const advance = groupMonths(open.filter((d) => d.due.slice(0, 7) > targetMonth));
  const currentTotal = current.reduce((n, d) => n + d.balance, 0);
  const currentLate = current.reduce((n, d) => n + d.lateFee, 0);
  const previousTotal = previous.reduce((n, g) => n + g.amount, 0);
  const previousLate = previous.reduce((n, g) => n + g.lateFee, 0);
  return {
    targetMonth,
    label: monthLabel(targetMonth),
    current,
    currentTotal,
    currentLate,
    previous,
    previousTotal,
    previousLate,
    advance,
    lateFeeTotal: currentLate + previousLate,
    totalOutstanding: currentTotal + previousTotal + currentLate + previousLate,
  };
}

export type FeeSummary = ReturnType<typeof feeSummary>;

/** The session's months ("2026-04" … "2027-03"), for choosing a target month. */
export function sessionMonths(sessionStart: string) {
  return Array.from({ length: 12 }, (_, i) => {
    const [y, m] = sessionMonth(sessionStart, i);
    return iso(y, m, 1).slice(0, 7);
  });
}

/**
 * Spreads a discount over the chosen instalments: this month's first, then
 * earlier unpaid months (most recent first), then months paid in advance.
 */
export function allocateDiscount(chosen: { key: string; balance: number; month: string }[], discount: number, targetMonth: string) {
  const rank = (m: string) => (m === targetMonth ? 0 : m < targetMonth ? 1 : 2);
  const order = [...chosen].sort((a, b) => rank(a.month) - rank(b.month) || (rank(a.month) === 2 ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month)));
  const out = new Map<string, number>();
  let left = discount;
  for (const c of order) {
    if (left <= 0) break;
    const take = Math.min(left, c.balance);
    if (take > 0) out.set(c.key, take);
    left -= take;
  }
  return out;
}

/* ───────────────────────── Paying an amount (Fee desk) ───────────────────────── */

export type PaymentLine = { item: DueItem; amount: number; discount: number; lateFee: number; full: boolean };

/**
 * Applies an amount received to a student's unpaid instalments, oldest first
 * (last session's arrears, then earlier months, this month, then months ahead).
 * A discount is taken off the oldest instalments first. An instalment's late
 * fee (by the payment date) is collected when that instalment is paid in full;
 * a part payment leaves the late fee owing. Shared by the Fee desk's preview
 * and its server action, so both always agree.
 */
export function allocatePayment(items: DueItem[], { amount, discount = 0, waiveLate = false, payDate }: { amount: number; discount?: number; waiveLate?: boolean; payDate: string }) {
  const open = items
    .filter((d) => d.balance > 0)
    .sort((a, b) => (a.arrears ? 0 : 1) - (b.arrears ? 0 : 1) || a.due.localeCompare(b.due) || a.headName.localeCompare(b.headName));
  let cash = Math.max(0, amount);
  let disc = Math.max(0, discount);
  let lateWaived = 0;
  const lines: PaymentLine[] = [];
  for (const d of open) {
    if (cash <= 0 && disc <= 0) break;
    const late = payDate > d.lateAfter ? d.lateFeeRate : 0;
    const dsc = Math.min(disc, d.balance);
    disc -= dsc;
    const base = d.balance - dsc;
    const lateDue = waiveLate ? 0 : late;
    let pay = 0;
    let lateFee = 0;
    let full = false;
    if (cash >= base + lateDue) {
      pay = base;
      lateFee = lateDue;
      cash -= base + lateDue;
      full = true;
      if (waiveLate) lateWaived += late;
    } else {
      pay = Math.min(cash, base);
      cash -= pay;
    }
    if (pay + dsc > 0) lines.push({ item: d, amount: pay, discount: dsc, lateFee, full });
  }
  return {
    lines,
    /** Received but more than everything owed for the session. */
    excess: cash,
    /** Discount left over because the amount didn't reach enough instalments. */
    unusedDiscount: disc,
    lateWaived,
    total: lines.reduce((n, l) => n + l.amount + l.lateFee, 0),
  };
}

/** What a student owes, three ways, for the Fee desk's quick amounts (late fees as of `payDate`). */
export function quickAmounts(items: DueItem[], payDate: string) {
  const open = items.filter((d) => d.balance > 0);
  const owe = (d: DueItem) => d.balance + (payDate > d.lateAfter ? d.lateFeeRate : 0);
  const sum = (list: DueItem[]) => list.reduce((n, d) => n + owe(d), 0);
  return {
    dueNow: sum(open.filter((d) => d.arrears || d.due <= payDate)),
    upToMonth: sum(open.filter((d) => d.arrears || d.due.slice(0, 7) <= payDate.slice(0, 7))),
    session: sum(open),
  };
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
