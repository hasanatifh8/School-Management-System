import "server-only";
import type { CalendarEvent, Prisma } from "@/generated/prisma/client";
import { addDays, isoDate, isSunday, parseISODate } from "@/lib/attendance-shared";
import type { CalendarItem } from "@/lib/calendar-shared";
import { db } from "@/lib/db";

/** Longest holiday a single entry may add, as for the holidays page. */
export const MAX_HOLIDAY_DAYS = 60;

type Session = { id: string; startDate: Date; endDate: Date };

/**
 * The session's calendar: planned entries (drafts too for admins), the date
 * sheets of exams, and holidays added on the holidays page. `forTeacher`
 * shows only what is published.
 */
export async function loadCalendar(schoolId: string, session: Session, { forTeacher = false, links = "" }: { forTeacher?: boolean; links?: "admin" | "" } = {}) {
  const [events, classes, exams, holidays] = await Promise.all([
    db.calendarEvent.findMany({
      where: { schoolId, sessionId: session.id, ...(forTeacher && { published: true }) },
      orderBy: [{ startDate: "asc" }, { title: "asc" }],
      include: { attachment: { select: { fileName: true } } },
    }),
    db.schoolClass.findMany({ where: { schoolId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.exam.findMany({
      where: { schoolId, sessionId: session.id, kind: "EXAM", papers: { some: {} }, ...(forTeacher && { published: true }) },
      select: {
        id: true,
        name: true,
        published: true,
        papers: { select: { date: true } },
        sections: { select: { section: { select: { class: { select: { id: true, name: true } } } } } },
      },
    }),
    db.holiday.findMany({
      where: { schoolId, eventId: null, date: { gte: session.startDate, lte: session.endDate } },
      orderBy: { date: "asc" },
    }),
  ]);
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const classList = (ids: string[]) => {
    if (!ids.length || ids.length === classes.length) return "Whole school";
    const names = classes.filter((c) => ids.includes(c.id)).map((c) => c.name);
    return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more` : names.join(", ");
  };

  const items: CalendarItem[] = [
    ...events.map((e) => ({
      key: `p-${e.id}`,
      type: e.type,
      title: e.title,
      start: isoDate(e.startDate),
      end: isoDate(e.endDate),
      classes: classList(e.classIds.filter((id) => className.has(id))),
      description: e.description,
      draft: !e.published,
      source: "plan" as const,
      href: links === "admin" ? `/admin/calendar/${e.id}` : undefined,
      attachment: e.attachment ? { name: e.attachment.fileName, href: `/api/calendar/${e.id}/attachment` } : undefined,
    })),
    ...exams.map((x) => {
      const dates = x.papers.map((p) => isoDate(p.date)).sort();
      return {
        key: `x-${x.id}`,
        type: "EXAM" as const,
        title: x.name,
        start: dates[0],
        end: dates.at(-1)!,
        classes: classList([...new Set(x.sections.map((s) => s.section.class.id))]),
        description: "Date sheet from Exams & tests",
        draft: !x.published,
        source: "exam" as const,
        href: links === "admin" ? `/admin/exams/${x.id}` : undefined,
      };
    }),
    ...groupHolidays(holidays).map((h) => ({
      key: `h-${h.start}`,
      type: "HOLIDAY" as const,
      title: h.name,
      start: h.start,
      end: h.end,
      classes: "Whole school",
      source: "holiday" as const,
      href: links === "admin" ? "/admin/attendance/holidays" : undefined,
    })),
  ];
  items.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title));
  return { items, classes, drafts: events.filter((e) => !e.published).length };
}

/** Consecutive holiday days with the same name (Sundays between them allowed) become one entry. */
function groupHolidays(holidays: { date: Date; name: string }[]) {
  const out: { name: string; start: string; end: string }[] = [];
  for (const h of holidays) {
    const day = isoDate(h.date);
    const last = out.at(-1);
    let next = last && addDays(last.end, 1);
    if (next && isSunday(next)) next = addDays(next, 1);
    if (last && last.name === h.name && next === day) last.end = day;
    else out.push({ name: h.name, start: day, end: day });
  }
  return out;
}

/**
 * Makes attendance follow a published holiday entry: its days become school
 * holidays (Sundays in a range are skipped; days already a holiday are left alone).
 * Entries that aren't published holidays own no holiday days.
 */
export async function syncEventHolidays(tx: Prisma.TransactionClient, event: CalendarEvent) {
  await tx.holiday.deleteMany({ where: { eventId: event.id } });
  if (event.type !== "HOLIDAY" || !event.published) return;
  const from = isoDate(event.startDate);
  const to = isoDate(event.endDate);
  const dates: string[] = [];
  for (let day = from; day <= to && dates.length <= MAX_HOLIDAY_DAYS; day = addDays(day, 1)) {
    if (from === to || !isSunday(day)) dates.push(day);
  }
  const taken = await tx.holiday.findMany({
    where: { schoolId: event.schoolId, date: { in: dates.map((d) => parseISODate(d)!) } },
    select: { date: true },
  });
  const skip = new Set(taken.map((t) => isoDate(t.date)));
  await tx.holiday.createMany({
    data: dates.filter((d) => !skip.has(d)).map((d) => ({ schoolId: event.schoolId, date: parseISODate(d)!, name: event.title, eventId: event.id })),
  });
}
