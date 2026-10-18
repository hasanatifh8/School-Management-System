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
 * person's values (component id → rupees or percent) that replace the default;
 * a component with neither isn't paid. Amounts are whole rupees.
 */
export function computeSalary(basic: number, components: ComponentDef[], own: Record<string, number>) {
  const lines: SlipLine[] = basic > 0 ? [{ name: BASIC_PAY, kind: "EARNING", amount: basic, note: "Monthly basic pay" }] : [];
  for (const c of components) {
    const value = own[c.id] ?? c.defaultValue;
    if (value == null) continue;
    const amount = Math.round(c.calc === "FIXED" ? value : (basic * value) / 100);
    const note = c.calc === "FIXED" ? "Fixed amount every month" : `${+value.toFixed(2)}% of basic pay (${inr(basic)})`;
    if (amount > 0) lines.push({ name: c.name, kind: c.kind, amount, note });
  }
  const gross = lines.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amount, 0);
  const deductions = lines.filter((l) => l.kind === "DEDUCTION").reduce((n, l) => n + l.amount, 0);
  return { lines, gross, deductions, net: Math.max(0, gross - deductions) };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Why loss of pay was taken off, e.g. "2.5 unpaid days × ₹1,355 a day (gross ₹42,000 ÷ 31 days)". */
export function lopNote(gross: number, lopDays: number, daysInMonth: number, detail?: { absent: number; halfDays: number }) {
  const parts = detail ? [detail.absent && `${detail.absent} absent`, detail.halfDays && `${detail.halfDays} half day${detail.halfDays === 1 ? "" : "s"}`].filter(Boolean).join(", ") : "";
  return `${dayCount(lopDays)} unpaid${parts ? ` (${parts})` : ""} × ${inr(gross / daysInMonth)} a day (gross ${inr(gross)} ÷ ${daysInMonth} days)`;
}

/** Pay for unpaid days: the month's gross for each day of the month (calendar days), times the days. */
export const lopAmount = (gross: number, lopDays: number, daysInMonth: number) => (lopDays > 0 && daysInMonth > 0 ? Math.round((gross / daysInMonth) * lopDays) : 0);

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
