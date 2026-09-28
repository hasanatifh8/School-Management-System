// Timetable helpers safe for client components.

export const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Periods that aren't a subject, offered in every timetable. */
export const SLOT_LABELS = ["Library", "Games", "Assembly", "Activity", "Free period"] as const;

export type PeriodInfo = { id: string; name: string; startTime: string; endTime: string; isBreak: boolean };

/** Key of one cell: day and period. */
export const slotKey = (day: number, periodId: string) => `${day}:${periodId}`;

/** "13:05" → "1:05 pm" */
export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export const periodTime = (p: { startTime: string; endTime: string }) => `${formatTime(p.startTime)} – ${formatTime(p.endTime)}`;
