// Salary maths shared by the server and the salary forms in the browser.

export type SalaryKind = "EARNING" | "DEDUCTION";
export type SalaryCalcKey = "FIXED" | "PERCENT_OF_BASIC";

/** A salary component as the school set it up (see SalaryComponent). */
export type ComponentDef = { id: string; name: string; kind: SalaryKind; calc: SalaryCalcKey; defaultValue: number | null };

/** One line of a salary slip; `note` says how it was worked out or why it was taken off. */
export type SlipLine = { name: string; kind: SalaryKind; amount: number; note?: string };

export const KIND_LABELS: Record<SalaryKind, string> = { EARNING: "Earning", DEDUCTION: "Deduction" };
export const CALC_LABELS: Record<SalaryCalcKey, string> = { FIXED: "Fixed ₹ a month", PERCENT_OF_BASIC: "% of basic pay" };

export const BASIC_PAY = "Basic pay";

/** "₹ 2,000" or "40% of basic", for a component's value. */
export function valueLabel(calc: SalaryCalcKey, value: number) {
  return calc === "FIXED" ? `₹${Math.round(value).toLocaleString("en-IN")}` : `${+value.toFixed(2)}% of basic`;
}

/**
 * A month's salary from basic pay and the school's components. `own` holds the
 * person's values (component id → rupees or percent) that replace the default
 * (0 = not applied to them); a component with neither isn't paid. Each line's
 * note says how it's worked out and where the value comes from. Whole rupees.
 */
export function computeSalary(basic: number, components: ComponentDef[], own: Record<string, number>) {
  const lines: SlipLine[] = basic > 0 ? [{ name: BASIC_PAY, kind: "EARNING", amount: basic, note: "Monthly basic pay" }] : [];
  for (const c of components) {
    // A person's own value wins over the default; an own value of 0 means "not applied" for them.
    const mine = own[c.id] != null;
    const value = mine ? own[c.id] : c.defaultValue;
    if (value == null) continue;
    const amount = Math.round(c.calc === "FIXED" ? value : (basic * value) / 100);
    const how = c.calc === "FIXED" ? "Fixed" : `${+value.toFixed(2)}% of basic pay (${inr(basic)})`;
    const note = `${how}, every month · ${mine ? "set for this person" : "school default"}`;
    if (amount > 0) lines.push({ name: c.name, kind: c.kind, amount, note });
  }
  const gross = lines.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amount, 0);
  const deductions = lines.filter((l) => l.kind === "DEDUCTION").reduce((n, l) => n + l.amount, 0);
  return { lines, gross, deductions, net: Math.max(0, gross - deductions) };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * How absent days are taken off a salary (Settings → Payroll), set by the school:
 * - DAY_PAY: a day's pay (gross or basic ÷ `divisor`, or ÷ the days in the
 *   month when `divisor` is null), times `percent`, for each unpaid day;
 * - FIXED: `amount` rupees for each unpaid day.
 * A half day is always half an unpaid day. With `countUnmarked`, a working day
 * with no attendance mark (and no approved leave) is unpaid too.
 */
export type LopRule = (
  | { method: "DAY_PAY"; base: "GROSS" | "BASIC"; divisor: number | null; percent: number }
  | { method: "FIXED"; amount: number }
) & { countUnmarked: boolean };

/** Until a school chooses: the month's gross ÷ its days, 100% a day; unmarked days not deducted. */
export const DEFAULT_LOP_RULE: LopRule = { method: "DAY_PAY", base: "GROSS", divisor: null, percent: 100, countUnmarked: false };

/** A school's saved rule (JSON), or the default when missing or unreadable. */
export function readLopRule(raw: unknown): LopRule {
  const r = raw as Partial<Record<string, unknown>> | null;
  const countUnmarked = r?.countUnmarked === true;
  if (r?.method === "FIXED" && typeof r.amount === "number" && r.amount >= 0) return { method: "FIXED", amount: Math.round(r.amount), countUnmarked };
  if (r?.method === "DAY_PAY") {
    const divisor = typeof r.divisor === "number" && r.divisor >= 1 && r.divisor <= 31 ? Math.round(r.divisor) : null;
    const percent = typeof r.percent === "number" && r.percent >= 0 && r.percent <= 300 ? r.percent : 100;
    return { method: "DAY_PAY", base: r.base === "BASIC" ? "BASIC" : "GROSS", divisor, percent, countUnmarked };
  }
  return DEFAULT_LOP_RULE;
}

/** What one unpaid day takes off, in rupees (unrounded), for a salary with this gross and basic. */
export function lopDayRate(rule: LopRule, pay: { gross: number; basic: number }, daysInMonth: number) {
  if (rule.method === "FIXED") return rule.amount;
  const days = rule.divisor ?? daysInMonth;
  if (!days) return 0;
  return ((rule.base === "BASIC" ? pay.basic : pay.gross) / days) * (rule.percent / 100);
}

/** Pay taken off for unpaid days. */
export const lopAmount = (rule: LopRule, pay: { gross: number; basic: number }, lopDays: number, daysInMonth: number) =>
  lopDays > 0 ? Math.round(lopDayRate(rule, pay, daysInMonth) * lopDays) : 0;

/** A month's unpaid days by why: absent, half days (each half), not marked, and leave over a monthly cap. */
export type LopCount = { absent: number; halfDays: number; unmarked: number; overLimit: number };

export const NO_LOP: LopCount = { absent: 0, halfDays: 0, unmarked: 0, overLimit: 0 };

/** Unpaid days in all: a half day is half a day. */
export const lopTotal = (c: LopCount) => c.absent + c.halfDays / 2 + c.unmarked + c.overLimit;

/** "2 absent, 1 half day, 7 not marked". */
export function lopParts(c: LopCount) {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  return [
    c.absent && `${c.absent} absent`,
    c.halfDays && plural(c.halfDays, "half day"),
    c.unmarked && `${c.unmarked} not marked`,
    c.overLimit && `${c.overLimit} over leave limit`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Why loss of pay was taken off, e.g. "9 days unpaid (2 absent, 7 not marked) × ₹343 a day (gross ₹10,300 ÷ 30 days)". */
export function lopNote(rule: LopRule, pay: { gross: number; basic: number }, lop: LopCount, daysInMonth: number) {
  const rate = lopDayRate(rule, pay, daysInMonth);
  const head = `${dayCount(lopTotal(lop))} unpaid${lopParts(lop) ? ` (${lopParts(lop)})` : ""} × ${inr(rate)} a day`;
  if (rule.method === "FIXED") return `${head} (fixed)`;
  const base = rule.base === "BASIC" ? `basic ${inr(pay.basic)}` : `gross ${inr(pay.gross)}`;
  const share = rule.percent === 100 ? "" : `, ${+rule.percent.toFixed(2)}% of a day's pay`;
  return `${head} (${base} ÷ ${rule.divisor ?? daysInMonth} days${share})`;
}

/** The rule in a sentence, e.g. "Gross pay ÷ 30 for each absent day". */
export function lopRuleText(rule: LopRule) {
  if (rule.method === "FIXED") return `${inr(rule.amount)} for each absent day`;
  const share = rule.percent === 100 ? "" : `${+rule.percent.toFixed(2)}% of `;
  return `${share}${rule.base === "BASIC" ? "basic" : "gross"} pay ÷ ${rule.divisor ?? "the days in the month"} for each absent day`;
}

/** "1.5 days", "1 day". */
export const dayCount = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
function belowThousand(n: number) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Whole rupees in words, Indian style: 152500 → "Rupees One Lakh Fifty Two Thousand Five Hundred Only". */
export function rupeesInWords(amount: number) {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 100 ? belowThousand(crore) : belowHundred(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return `Rupees ${parts.join(" ")} Only`;
}

/** A month's worked-out salary (see monthSalary): lines, totals, and unpaid days with what they'd take off. */
export type MonthPay = { lines: SlipLine[]; gross: number; deductions: number; net: number; lopDays: number; lop: LopCount; lopAmount: number; lopNote: string };

/**
 * The slip a payment saves: the person's salary lines, unpaid days if the admin
 * chose to deduct them, and an adjustment when the amount paid differs.
 */
export function slipFor(pay: MonthPay | null, deductLop: boolean, amount: number) {
  if (!pay) return { lines: [{ name: "Salary", kind: "EARNING", amount }] as SlipLine[], gross: amount, lopDays: null, lopAmount: null };
  const lop = deductLop && pay.lopAmount > 0;
  const lines: SlipLine[] = [...pay.lines];
  if (lop)
    lines.push({
      name: `Loss of pay (${dayCount(pay.lopDays)})`,
      kind: "DEDUCTION",
      amount: pay.lopAmount,
      note: pay.lopNote,
    });
  const expected = Math.max(0, pay.net - (lop ? pay.lopAmount : 0));
  if (amount > expected) lines.push({ name: "Adjustment", kind: "EARNING", amount: amount - expected, note: "Paid more than the worked-out salary" });
  else if (amount < expected) lines.push({ name: "Adjustment", kind: "DEDUCTION", amount: expected - amount, note: "Paid less than the worked-out salary" });
  return {
    lines,
    gross: pay.gross + (amount > expected ? amount - expected : 0),
    lopDays: lop ? pay.lopDays : null,
    lopAmount: lop ? pay.lopAmount : null,
  };
}

/** Where a person's salary stands for a month. */
export type PayStatus = "unpaid" | "draft" | "published" | "nosalary";

/** One person on a month's payroll, as the Payroll page lists them. */
export type RosterRow = {
  key: string; // "T:<id>" / "S:<id>" ("P:<paymentId>" for someone since removed)
  type: "TEACHER" | "STAFF";
  name: string;
  role: string;
  /** Their Salary tab, or null for someone since removed. */
  profileHref: string | null;
  status: PayStatus;
  /** Worked out from the salary structure (with one-time items), before unpaid days. */
  gross: number;
  net: number;
  lopDays: number;
  /** Of the unpaid days, working days with no attendance mark. */
  unmarked: number;
  /** What the unpaid days are, e.g. "2 absent, 7 not marked". */
  lopWhy: string;
  lopAmount: number;
  /** One-time items this month. */
  items: number;
  payment: { id: string; amount: number; paidOn: string; mode: string; published: boolean } | null;
};

/** "Loss of pay" lines are the school's absence deduction: no component may use the name. */
export const isReservedName = (name: string) => /^\s*loss of pay/i.test(name);

/**
 * A deduction component named like an absence deduction ("leave deduction",
 * "absent cut", "LOP"): it would be taken off every month regardless of
 * attendance, which is almost never what's meant.
 */
export const looksLikeAbsence = (name: string) => /\b(leave|absen\w*|lop|unpaid|half[ -]?day|late)\b/i.test(name);
