import Link from "next/link";
import { CalendarDays, Paperclip } from "lucide-react";
import { Badge, Card, EmptyState, IconTile } from "@/components/ui";
import { addDays } from "@/lib/attendance-shared";
import { EVENT_META, EVENT_TYPES, type CalendarItem } from "@/lib/calendar-shared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PRIORITY = ["HOLIDAY", "EXAM", "TEST", "SPORTS", "EVENT", "MEETING", "ACTIVITY"] as const;
const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * The session at a glance: twelve small months coloured by what happens each
 * day, and the chosen month's entries listed below. Months link with ?month=.
 */
export function SessionCalendar({
  items,
  start,
  end,
  today,
  month,
  basePath,
}: {
  items: CalendarItem[];
  start: string;
  end: string;
  today: string;
  /** "2026-10": the month whose entries are listed. */
  month: string;
  basePath: string;
}) {
  // Every day → the entries on it.
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) {
    for (let day = it.start; day <= it.end; day = addDays(day, 1)) byDay.set(day, [...(byDay.get(day) ?? []), it]);
  }
  const months: string[] = [];
  for (let m = start.slice(0, 7); m <= end.slice(0, 7); m = nextMonth(m)) months.push(m);
  const listed = items.filter((it) => it.start.slice(0, 7) <= month && it.end.slice(0, 7) >= month);
  const counts = new Map(EVENT_TYPES.map((t) => [t, items.filter((i) => i.type === t).length]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        {EVENT_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${EVENT_META[t].dot}`} />
            {EVENT_META[t].label}
            <span className="tabular-nums text-subtle">{counts.get(t)}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {months.map((m) => (
          <MiniMonth key={m} month={m} byDay={byDay} start={start} end={end} today={today} active={m === month} href={`${basePath}?month=${m}`} />
        ))}
      </div>

      <Card title={`${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`} icon={CalendarDays} description={`${listed.length} entr${listed.length === 1 ? "y" : "ies"}`} padded={false}>
        {listed.length === 0 ? (
          <EmptyState compact icon={CalendarDays} title="Nothing planned this month" description="Pick another month above." />
        ) : (
          <ul className="divide-y divide-line">
            {listed.map((it) => {
              const meta = EVENT_META[it.type];
              const body = (
                <>
                  <span className="w-16 shrink-0 text-center">
                    <span className="block text-lg font-semibold leading-tight tabular-nums text-fg">{Number(it.start.slice(8))}</span>
                    <span className="block text-[11px] uppercase text-muted">{weekday.format(d(it.start))}</span>
                  </span>
                  <IconTile icon={meta.icon} tone={meta.tone} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-fg">{it.title}</span>
                      {it.draft && <Badge tone="amber">{it.source === "exam" ? "Not published" : "Draft"}</Badge>}
                    </span>
                    <span className="block text-xs text-muted">
                      {meta.label} · {it.start === it.end ? dayMonth.format(d(it.start)) : `${dayMonth.format(d(it.start))} – ${dayMonth.format(d(it.end))}`} ·{" "}
                      {it.classes}
                    </span>
                    {it.description && <span className="mt-0.5 block truncate text-xs text-fg-2">{it.description}</span>}
                  </span>
                </>
              );
              return (
                <li key={it.key} className="flex items-center gap-2 pr-4 transition hover:bg-surface-2 sm:pr-6">
                  {it.href ? (
                    <Link href={it.href} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 sm:pl-6">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 sm:pl-6">{body}</div>
                  )}
                  {it.attachment && (
                    <a
                      href={it.attachment.href}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open ${it.attachment.name}`}
                      className="inline-flex max-w-44 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-2 transition hover:border-accent-line hover:text-accent-text"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{it.attachment.name}</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MiniMonth({
  month,
  byDay,
  start,
  end,
  today,
  active,
  href,
}: {
  month: string;
  byDay: Map<string, CalendarItem[]>;
  start: string;
  end: string;
  today: string;
  active: boolean;
  href: string;
}) {
  const first = `${month}-01`;
  const lead = (d(first).getUTCDay() + 6) % 7; // Monday first
  const days: string[] = [];
  for (let day = first; day.slice(0, 7) === month; day = addDays(day, 1)) days.push(day);
  const planned = new Set(days.flatMap((day) => (byDay.get(day) ?? []).map((i) => i.key))).size;

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`block rounded-2xl border bg-surface p-3 shadow-card transition hover:shadow-lift ${active ? "border-accent ring-2 ring-accent/20" : "border-line"}`}
    >
      <p className="mb-2 flex items-center justify-between text-sm font-semibold text-fg">
        {MONTHS[Number(month.slice(5, 7)) - 1].slice(0, 3)} {month.slice(0, 4)}
        {planned > 0 && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] font-medium tabular-nums text-fg-2">{planned}</span>}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-subtle">
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
          <span key={i} className="pb-0.5">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {days.map((day) => {
          const on = byDay.get(day) ?? [];
          const top = PRIORITY.find((t) => on.some((i) => i.type === t));
          const outside = day < start || day > end;
          const sunday = d(day).getUTCDay() === 0;
          return (
            <span
              key={day}
              title={on.length ? on.map((i) => `${EVENT_META[i.type].label}: ${i.title}${i.attachment ? " (attachment)" : ""}`).join("\n") : undefined}
              className={`flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums ${
                top ? `${EVENT_META[top].day} font-semibold` : outside ? "text-subtle/50" : sunday ? "text-danger/70" : "text-fg-2"
              } ${day === today ? "ring-2 ring-accent" : ""}`}
            >
              {Number(day.slice(8))}
            </span>
          );
        })}
      </div>
    </Link>
  );
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/** The month to list: the requested one if inside the session, else this month, else the first. */
export function pickCalendarMonth(param: string | string[] | undefined, start: string, end: string, today: string) {
  const m = typeof param === "string" && /^\d{4}-\d{2}$/.test(param) ? param : today.slice(0, 7);
  return m < start.slice(0, 7) || m > end.slice(0, 7) ? start.slice(0, 7) : m;
}
