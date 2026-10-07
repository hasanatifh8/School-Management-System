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

/** Months from the session's first month to calendar month `month` (1–12); 0 when none is set. */
function monthOffset(month: number | null, sessionStart: string) {
  return month ? (month - Number(sessionStart.slice(5, 7)) + 12) % 12 : 0;
}

/** How many months apart a fee's instalments are, for the frequencies whose due month can be chosen. */
export const INSTALMENT_GAP: Partial<Record<Frequency, number>> = { QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };

/**
 * The calendar months (1–12) a quarterly, half-yearly or yearly fee falls due,
 * given the first one chosen; sessionStartMonth is the session's first month (4 = April).
 */
export function dueMonthsOf(frequency: Frequency, firstMonth: number | null, sessionStartMonth: number) {
  const gap = INSTALMENT_GAP[frequency];
  if (!gap) return [];
  const first = firstMonth ? (firstMonth - sessionStartMonth + 12) % 12 % gap : 0;
  return Array.from({ length: 12 / gap }, (_, i) => ((sessionStartMonth - 1 + first + i * gap) % 12) + 1);
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
    case "QUARTERLY": {
      // Each quarter falls due in the same month of it: the first (Apr, Jul…) unless another was chosen.
      const at = monthOffset(head.dueMonth, sessionStart) % 3;
      return [0, 1, 2, 3].map((q) => {
        const [, a] = sessionMonth(sessionStart, q * 3);
        const [, b] = sessionMonth(sessionStart, q * 3 + 2);
        return { key: `Q${q + 1}`, label: `Q${q + 1} · ${MONTH_NAMES[a]}–${MONTH_NAMES[b]}`, ...span(sessionStart, q * 3, 3, dueDay), due: span(sessionStart, q * 3 + at, 1, dueDay).due };
      });
    }
    case "HALF_YEARLY": {
      const at = monthOffset(head.dueMonth, sessionStart) % 6;
      return [0, 1].map((h) => {
        const [, a] = sessionMonth(sessionStart, h * 6);
        const [, b] = sessionMonth(sessionStart, h * 6 + 5);
        return { key: `H${h + 1}`, label: `${MONTH_NAMES[a]}–${MONTH_NAMES[b]}`, ...span(sessionStart, h * 6, 6, dueDay), due: span(sessionStart, h * 6 + at, 1, dueDay).due };
      });
    }
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
  /** Amount is the student's transport stop fare (monthly), not a class amount. */
  transport: boolean;
  dueDay: number;
  dueMonth: number | null;
  /** Extra charge when an instalment is paid after its due date. */
  lateFee: number;
  /** Charge the late fee again for every month the instalment stays unpaid (else once). */
  lateFeeMonthly: boolean;
  amounts: Record<string, number>; // classId → rupees
};

/** What a fee costs a student: their stop fare for the transport fee, else their class's amount. */
export function headAmount(head: Pick<FeeHeadInfo, "transport" | "amounts">, classId: string | null | undefined, transportFare: number) {
  if (head.transport) return transportFare > 0 ? transportFare : undefined;
  return classId ? head.amounts[classId] : undefined;
}

/** Monthly fare of a student's stop, or 0 when not on transport or the stop has no fare. */
export function stopFare(student: { transportStop: string | null; transportRoute: { stops: string[]; stopFares: number[] } | null }) {
  const r = student.transportRoute;
  if (!r || !student.transportStop) return 0;
  const i = r.stops.indexOf(student.transportStop);
  return i >= 0 ? (r.stopFares[i] ?? 0) : 0;
}

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
  /** Late fee owed as of today (see lateFeeMonths), and no late fee taken yet. */
  lateFee: number;
  /** The head's late fee, if one can still be charged on this instalment (0 if none or already paid). */
  lateFeeRate: number;
  /** The late fee repeats for each month unpaid (else it is charged once). */
  lateFeeMonthly: boolean;
  /** Late fees fall due by default only after this day: the due date, or the first due day after admission for a student who joined later. */
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
 *   they were added (`optIns` maps head → first day charged, null = whole session)
 *   up to a last month if one was set (`optUntil`, "2027-01"; none = session end).
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
  optUntil = new Map(),
  transportFare = 0,
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
  /** Opt-in head → last month charged ("2027-01"); absent = to the end of the session. */
  optUntil?: Map<string, string>;
  /** Monthly fare of the student's transport stop (0 = none), for the transport fee. */
  transportFare?: number;
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
    const amount = headAmount(head, classId, transportFare);
    // Anything already paid still shows, even if the head no longer applies.
    const applies = amount != null && amount > 0 && (!head.optional || optIns.has(head.id));
    const optFrom = head.optional ? (optIns.get(head.id) ?? null) : null;
    // An opt-in fee started before admission was set that way on purpose: it overrides the admission rule.
    const optOverride = !!optFrom && optFrom < admissionDate;
    const optTo = head.optional ? optUntil.get(head.id) : undefined;
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
          : p.end >= start && (!beforeAdmission || backOk) && (!optFrom || p.end >= optFrom)) &&
        // An opt-in fee set to stop after a month charges nothing later.
        (!optTo || p.start.slice(0, 7) <= optTo);
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
        lateFee: 0, // set below, once the item is complete
        lateFeeRate,
        lateFeeMonthly: head.lateFeeMonthly,
        lateAfter,
        lateFeePaid,
        beforeAdmission: beforeAdmission && head.frequency !== "ONE_TIME",
        arrears: null,
      });
    }
  }
  for (const d of items) d.lateFee = lateFeeOwed(d, today);
  return items.sort((a, b) => a.due.localeCompare(b.due) || a.headName.localeCompare(b.headName));
}

/** One month's late fee on an instalment: "<dueKey>@<n>", the month it covers, and whether it is charged unless changed. */
export type LateMonth = { key: string; label: string; from: string; amount: number; onByDefault: boolean; beforeAdmission: boolean };

/** `iso` date plus `n` months, on the same day (or the month's last day). */
function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const yy = y + Math.floor((m - 1 + n) / 12);
  const mm = (m - 1 + n) % 12;
  return iso(yy, mm, Math.min(d, lastDay(yy, mm)));
}

/**
 * The late fees on an unpaid instalment if paid on `payDate`: one for the month
 * it falls late, then (monthly late fees) one more for each further month it
 * stays unpaid, all charged unless fees staff untick them. Months before the
 * student's admission are flagged so staff can see them.
 */
export function lateFeeMonths(d: DueItem, payDate: string): LateMonth[] {
  if (d.balance <= 0 || d.lateFeeRate <= 0) return [];
  const out: LateMonth[] = [];
  for (let n = 0; n < 120; n++) {
    const from = addMonths(d.due, n);
    if (payDate <= from) break;
    out.push({ key: `${dueKey(d.headId, d.period)}@${n}`, label: monthLabel(from.slice(0, 7)), from, amount: d.lateFeeRate, onByDefault: true, beforeAdmission: from < d.lateAfter });
    if (!d.lateFeeMonthly) break;
  }
  return out;
}

/** Late fee owed on an instalment paid on `payDate`: the months charged by default, or as `choice` (key → charged) says. */
export function lateFeeOwed(d: DueItem, payDate: string, choice?: Record<string, boolean>) {
  return lateFeeMonths(d, payDate).reduce((n, l) => n + ((choice?.[l.key] ?? l.onByDefault) ? l.amount : 0), 0);
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
 * A discount comes off the bill as a whole: it is shared across the instalments
 * in proportion to what each owes (so no one fee looks cut), to settle them in
 * the books. An instalment's late
 * fee (by the payment date) is collected when that instalment is paid in full;
 * a part payment leaves the late fee owing. Shared by the Fee desk's preview
 * and its server action, so both always agree.
 */
export function allocatePayment(
  items: DueItem[],
  { amount, discount = 0, waiveLate = false, lateChoice, payDate }: { amount: number; discount?: number; waiveLate?: boolean; lateChoice?: Record<string, boolean>; payDate: string },
) {
  const open = items
    .filter((d) => d.balance > 0)
    .sort((a, b) => (a.arrears ? 0 : 1) - (b.arrears ? 0 : 1) || a.due.localeCompare(b.due) || a.headName.localeCompare(b.headName));
  let cash = Math.max(0, amount);
  const share = shareDiscount(open, Math.max(0, discount));
  // Discount beyond everything owed is left over (unusedDiscount).
  const disc = Math.max(0, discount) - [...share.values()].reduce((n, v) => n + v, 0);
  let lateWaived = 0;
  const lines: PaymentLine[] = [];
  for (const d of open) {
    if (cash <= 0 && !share.get(d)) continue;
    // The usual late fee, and what is charged after any months were ticked off (or on).
    const late = lateFeeOwed(d, payDate);
    const dsc = share.get(d) ?? 0;
    const base = d.balance - dsc;
    const lateDue = waiveLate ? 0 : lateFeeOwed(d, payDate, lateChoice);
    let pay = 0;
    let lateFee = 0;
    let full = false;
    if (cash >= base + lateDue) {
      pay = base;
      lateFee = lateDue;
      cash -= base + lateDue;
      full = true;
      lateWaived += Math.max(0, late - lateDue);
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

/** The Fee desk row an instalment belongs to: its due month ("2026-07"), or "arrears" for last session's. */
export const deskMonth = (d: DueItem) => (d.arrears ? "arrears" : d.due.slice(0, 7));

export type DeskMonthStatus = "PAID" | "PARTIAL" | "OVERDUE" | "DUE" | "UPCOMING" | "NONE";

/**
 * A student's fees as Fee desk months: one per month of the session (and one
 * for last session's arrears, first), each with its instalments, what is left,
 * the late fee owing by `payDate`, and a status.
 */
export function deskMonths(dues: DueItem[], sessionStart: string, payDate: string) {
  const keys = [...(dues.some((d) => d.arrears) ? ["arrears"] : []), ...sessionMonths(sessionStart)];
  return keys.map((key) => {
    const items = dues.filter((d) => deskMonth(d) === key);
    const charged = items.reduce((n, d) => n + d.amount, 0);
    const balance = items.reduce((n, d) => n + d.balance, 0);
    const late = items.reduce((n, d) => n + lateFeeOwed(d, payDate), 0);
    const status: DeskMonthStatus = !items.length
      ? "NONE"
      : balance === 0
        ? "PAID"
        : items.some((d) => d.paid + d.discount > 0)
          ? "PARTIAL"
          : items.some((d) => d.balance > 0 && d.due < payDate)
            ? "OVERDUE"
            : key.slice(0, 7) <= payDate.slice(0, 7) || key === "arrears"
              ? "DUE"
              : "UPCOMING";
    const label = key === "arrears" ? `Unpaid from ${items[0]?.arrears ?? "last session"}` : monthLabel(key);
    return { key, label, items, charged, balance, late, status };
  });
}

export type DeskMonth = ReturnType<typeof deskMonths>[number];

/**
 * The month whose bill collects `key`'s balance: its own, or for a part-paid
 * month the next month with fees (the rest moves on as "previous dues").
 */
export function billMonthFor(months: DeskMonth[], key: string): string {
  const i = months.findIndex((m) => m.key === key);
  const m = months[i];
  if (!m || m.status !== "PARTIAL") return key;
  const next = months.slice(i + 1).find((n) => n.items.length > 0);
  if (!next) return key;
  return next.status === "PARTIAL" ? billMonthFor(months, next.key) : next.key;
}

/**
 * A month's bill: the part-paid balances of earlier months carried into it,
 * then its own fees. `movedTo` is set when this month was part paid and its
 * balance is collected on a later bill instead.
 */
export function billOf(months: DeskMonth[], key: string) {
  const month = months.find((m) => m.key === key);
  if (!month) return null;
  const target = billMonthFor(months, key);
  const carried = months.filter((m) => m.key !== key && m.status === "PARTIAL" && m.balance > 0 && billMonthFor(months, m.key) === key);
  return { month, carried, keys: [...carried.map((m) => m.key), key], movedTo: target !== key ? months.find((m) => m.key === target)! : null };
}

/**
 * Pays the chosen months: every unpaid instalment in them, with late fees (as
 * of `payDate`, unless waived), less any discount; or, given `received`, only
 * that much (oldest first: a part payment, the rest left owing).
 * Shared by the Fee desk's preview and its server action, so both always agree.
 */
export function payMonths(
  items: DueItem[],
  months: string[],
  {
    discount = 0,
    waiveLate = false,
    lateChoice,
    received,
    payDate,
  }: { discount?: number; waiveLate?: boolean; lateChoice?: Record<string, boolean>; received?: number; payDate: string },
) {
  const chosen = new Set(months);
  const open = items.filter((d) => d.balance > 0 && chosen.has(deskMonth(d)));
  const fees = open.reduce((n, d) => n + d.balance, 0);
  const late = waiveLate ? 0 : open.reduce((n, d) => n + lateFeeOwed(d, payDate, lateChoice), 0);
  const full = Math.max(0, fees - discount) + late;
  const amount = received == null ? full : Math.min(received, full);
  return { ...allocatePayment(open, { amount, discount, waiveLate, lateChoice, payDate }), fees, late, full, excess: received == null ? 0 : Math.max(0, received - full) };
}

/**
 * Splits a bill-level discount across instalments in proportion to their
 * balances, in whole rupees (the leftover rupees go to the largest shares).
 * Never more than an instalment owes; anything beyond the bill is left unshared.
 */
function shareDiscount(items: DueItem[], discount: number) {
  const total = items.reduce((n, d) => n + d.balance, 0);
  const share = new Map<DueItem, number>();
  if (!discount || !total) return share;
  const off = Math.min(discount, total);
  const exact = items.map((d) => ({ d, x: (off * d.balance) / total }));
  for (const e of exact) share.set(e.d, Math.floor(e.x));
  let left = off - [...share.values()].reduce((n, v) => n + v, 0);
  for (const e of [...exact].sort((a, b) => (b.x % 1) - (a.x % 1))) {
    if (left <= 0) break;
    share.set(e.d, share.get(e.d)! + 1);
    left--;
  }
  return share;
}

/** What a student owes, three ways, for the Fee desk's quick amounts (late fees as of `payDate`). */
export function quickAmounts(items: DueItem[], payDate: string) {
  const open = items.filter((d) => d.balance > 0);
  const owe = (d: DueItem) => d.balance + lateFeeOwed(d, payDate);
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
