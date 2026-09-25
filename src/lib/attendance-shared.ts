// Attendance statuses and calendar-date helpers. No server-only imports, so
// client components can use them too.

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"] as const;
export type AttendanceStatusKey = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_META: Record<
  AttendanceStatusKey,
  { label: string; short: string; on: string; text: string }
> = {
  PRESENT: { label: "Present", short: "P", on: "bg-emerald-600 text-white ring-emerald-600", text: "text-emerald-700" },
  ABSENT: { label: "Absent", short: "A", on: "bg-rose-600 text-white ring-rose-600", text: "text-rose-700" },
  LATE: { label: "Late", short: "L", on: "bg-amber-500 text-white ring-amber-500", text: "text-amber-700" },
  HALF_DAY: { label: "Half day", short: "HD", on: "bg-sky-600 text-white ring-sky-600", text: "text-sky-700" },
  LEAVE: { label: "Leave", short: "LV", on: "bg-violet-600 text-white ring-violet-600", text: "text-violet-700" },
};

export type AttendanceCounts = Record<AttendanceStatusKey, number>;

export const emptyCounts = (): AttendanceCounts => ({ PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0 });

/**
 * Attendance percentage: present and late count as a full day, half day as
 * half; absent and leave count as not attended. Null when nothing is marked.
 */
export function attendancePercent(c: AttendanceCounts) {
  const total = c.PRESENT + c.ABSENT + c.LATE + c.HALF_DAY + c.LEAVE;
  if (!total) return null;
  return Math.round(((c.PRESENT + c.LATE + c.HALF_DAY / 2) / total) * 1000) / 10;
}

/* ───────────────────────── Calendar dates ─────────────────────────
 * Attendance dates are calendar days ("2026-09-25"), stored as Postgres
 * DATE and handled in JS as UTC midnight. "Today" is today in India. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "2026-09-25" → UTC-midnight Date, or null if it isn't a real date. */
export function parseISODate(s: string | null | undefined) {
  if (!s || !ISO_DATE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || isoDate(d) !== s ? null : d;
}

export function addDays(iso: string, days: number) {
  const d = parseISODate(iso)!;
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export const isSunday = (iso: string) => parseISODate(iso)!.getUTCDay() === 0;

/** "2026-09" → every date in that month. */
export function monthDates(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return isoDate(d).slice(0, 7);
}

export const longDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export const formatISO = (iso: string, f: Intl.DateTimeFormat = longDate) => f.format(parseISODate(iso)!);

/**
 * Groups holidays into breaks: back-to-back days with the same name (Sundays
 * in between allowed) become one entry. Expects dates in ascending order.
 */
export function groupHolidays<T extends { id: string; date: Date; name: string }>(holidays: T[]) {
  const groups: { name: string; from: string; to: string; ids: string[] }[] = [];
  for (const h of holidays) {
    const date = isoDate(h.date);
    const last = groups.at(-1);
    let next = last && addDays(last.to, 1);
    while (next && next < date && isSunday(next)) next = addDays(next, 1);
    if (last && last.name === h.name && next === date) {
      last.to = date;
      last.ids.push(h.id);
    } else groups.push({ name: h.name, from: date, to: date, ids: [h.id] });
  }
  return groups;
}
