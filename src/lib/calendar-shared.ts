// School calendar types and labels, safe for client components.
import { BookOpenCheck, CalendarHeart, ClipboardList, PartyPopper, Sparkles, Trophy, Users, type LucideIcon } from "lucide-react";
import type { CalendarEventType } from "@/generated/prisma/enums";

export const EVENT_TYPES = ["HOLIDAY", "EXAM", "TEST", "EVENT", "SPORTS", "MEETING", "ACTIVITY"] as const satisfies readonly CalendarEventType[];

/** Colour, icon and label per type. Holidays win when entries share a day. */
export const EVENT_META: Record<
  CalendarEventType,
  { label: string; icon: LucideIcon; tone: "rose" | "indigo" | "sky" | "violet" | "emerald" | "amber" | "teal"; day: string; dot: string }
> = {
  HOLIDAY: { label: "Holiday", icon: CalendarHeart, tone: "rose", day: "bg-rose-500/15 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  EXAM: { label: "Exam", icon: ClipboardList, tone: "indigo", day: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  TEST: { label: "Test", icon: BookOpenCheck, tone: "sky", day: "bg-sky-500/15 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  EVENT: { label: "Event", icon: PartyPopper, tone: "violet", day: "bg-violet-500/15 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  SPORTS: { label: "Sports", icon: Trophy, tone: "emerald", day: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  MEETING: { label: "Meeting / PTM", icon: Users, tone: "amber", day: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  ACTIVITY: { label: "Activity", icon: Sparkles, tone: "teal", day: "bg-teal-500/15 text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
};

/** One entry as shown on the calendar: a planned entry, an exam's date sheet or a school holiday. */
export type CalendarItem = {
  key: string;
  type: CalendarEventType;
  title: string;
  start: string; // ISO date
  end: string;
  classes: string; // "Whole school" or class names
  description?: string | null;
  draft?: boolean;
  /** Where the entry comes from: the plan, the Exams module or the holidays list. */
  source: "plan" | "exam" | "holiday";
  href?: string;
};
