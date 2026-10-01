// Building blocks shared by the admin and teacher dashboards.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Award, Cake, CalendarDays, ChevronRight, History, TriangleAlert, type LucideIcon } from "lucide-react";
import { AnimatedNumber, Avatar, Card, EmptyState, IconTile, TextLink, type IconTone } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { parseISODate } from "@/lib/attendance-shared";
import { EVENT_META, type CalendarItem } from "@/lib/calendar-shared";
import { photoUrl } from "@/lib/photos";

const DAY = 86_400_000;
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const kpiTones = {
  indigo: "from-indigo-500/[0.07] border-indigo-500/15",
  emerald: "from-emerald-500/[0.07] border-emerald-500/15",
  amber: "from-amber-500/[0.08] border-amber-500/20",
  violet: "from-violet-500/[0.07] border-violet-500/15",
  rose: "from-rose-500/[0.07] border-rose-500/15",
  teal: "from-teal-500/[0.07] border-teal-500/15",
  sky: "from-sky-500/[0.07] border-sky-500/15",
} as const;

/** One key number on a tinted card, linking to where it comes from. */
export function KpiCard({
  href,
  icon,
  tone,
  label,
  value,
  prefix,
  badge,
  empty,
  link,
}: {
  href: string;
  icon: LucideIcon;
  tone: keyof typeof kpiTones;
  label: string;
  /** A number counts up; text (e.g. "6 – A") is shown as it is; null shows `empty`. */
  value: number | string | null;
  prefix?: string;
  badge?: string;
  empty?: string;
  link: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex flex-col rounded-2xl border bg-surface bg-gradient-to-b to-transparent p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift",
        kpiTones[tone],
      )}
    >
      <IconTile icon={icon} tone={tone} size="md" />
      <p className="mt-4 text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-fg sm:text-display-sm">
        {value == null ? (
          <span className="text-base font-medium text-subtle">{empty}</span>
        ) : typeof value === "number" ? (
          <AnimatedNumber value={value} prefix={prefix} />
        ) : (
          value
        )}
      </p>
      <p className="mt-1 h-5 text-xs">{badge && <span className="rounded-full bg-surface-3 px-2 py-0.5 font-medium tabular-nums text-fg-2">{badge}</span>}</p>
      <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-accent-text">
        {link}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

/** Up to six KPI cards in a row on wide screens. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">{children}</div>;
}

export function QuickAction({ href, icon, tone, title, text }: { href: string; icon: LucideIcon; tone: IconTone; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3 transition hover:-translate-y-px hover:border-line-strong hover:bg-surface hover:shadow-lift sm:p-4"
    >
      <IconTile icon={icon} tone={tone} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block truncate text-xs text-muted">{text}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
    </Link>
  );
}

export function AttentionChip({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-warning-line bg-warning-soft px-3 py-1.5 text-xs font-medium text-fg transition hover:shadow-lift"
    >
      <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden />
      {children}
      <ArrowRight className="h-3.5 w-3.5 text-warning" aria-hidden />
    </Link>
  );
}

/* ───────────────────────── Birthdays ───────────────────────── */

export type Birthday = { id: string; href: string; name: string; photoId: string | null; sub: string; days: number; date: Date };

/** People whose birthday falls in the next 30 days, soonest first. */
export function upcomingBirthdays(
  people: { id: string; href: string; name: string; photoId: string | null; sub: string; dateOfBirth: Date | null }[],
  today: Date,
): Birthday[] {
  const todayMs = today.getTime();
  const y = today.getUTCFullYear();
  return people
    .filter((p) => p.dateOfBirth)
    .map(({ dateOfBirth: dob, ...p }) => {
      let next = Date.UTC(y, dob!.getUTCMonth(), dob!.getUTCDate());
      if (next < todayMs) next = Date.UTC(y + 1, dob!.getUTCMonth(), dob!.getUTCDate());
      return { ...p, days: Math.round((next - todayMs) / DAY), date: new Date(next) };
    })
    .filter((b) => b.days <= 30)
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}

export function BirthdaysCard({ birthdays, emptyText }: { birthdays: Birthday[]; emptyText: string }) {
  return (
    <Card title="Upcoming birthdays" icon={Cake} description="Next 30 days" padded={false}>
      {birthdays.length === 0 ? (
        <EmptyState compact icon={Cake} title="No birthdays soon" description={emptyText} />
      ) : (
        <ul className="divide-y divide-line">
          {birthdays.slice(0, 5).map((b) => (
            <li key={b.id}>
              <Link href={b.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6">
                <Avatar name={b.name} src={photoUrl(b.photoId)} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{b.name}</span>
                  <span className="block truncate text-xs text-muted">{b.sub}</span>
                </span>
                <span className="text-right text-xs">
                  <span className="block text-fg-2">{shortDate.format(b.date)}</span>
                  {b.days === 0 ? (
                    <span className="font-semibold text-danger">Today 🎂</span>
                  ) : (
                    <span className="text-muted">{b.days === 1 ? "Tomorrow" : `In ${b.days} days`}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
          {birthdays.length > 5 && <li className="px-4 py-2.5 text-xs text-muted sm:px-6">+{birthdays.length - 5} more this month</li>}
        </ul>
      )}
    </Card>
  );
}

/* ───────────────────────── Calendar ───────────────────────── */

export function UpcomingEventsCard({ events, calendarHref, empty }: { events: CalendarItem[]; calendarHref: string; empty: ReactNode }) {
  return (
    <Card title="Upcoming exams & events" icon={CalendarDays} padded={false} action={<TextLink href={calendarHref}>View calendar</TextLink>}>
      {events.length === 0 ? (
        empty
      ) : (
        <ul className="divide-y divide-line">
          {events.map((e) => {
            const meta = EVENT_META[e.type];
            const date = parseISODate(e.start)!;
            return (
              <li key={e.key}>
                <Link href={e.href ?? calendarHref} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                    <span className="text-base leading-none font-semibold tabular-nums">{date.getUTCDate()}</span>
                    <span className="mt-0.5 text-[10px] font-medium uppercase">{shortDate.format(date).split(" ")[1]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{e.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {e.start === e.end ? e.classes : `Till ${shortDate.format(parseISODate(e.end)!)} · ${e.classes}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-fg-2">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {e.draft ? "Draft" : meta.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ───────────────────────── Results ───────────────────────── */

export type PublishedResult = { examId: string; examName: string; kind: "EXAM" | "TEST"; sectionId: string; section: string; publishedAt: Date; publishedBy: string };

const publishedDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Results published most recently, one row per exam and section, each linking to its result sheet. */
export function RecentResultsCard({ results, empty }: { results: PublishedResult[]; empty: ReactNode }) {
  return (
    <Card title="Recent results" icon={Award} description="Published result sheets" padded={false} action={<TextLink href="/admin/exams">All exams</TextLink>}>
      {results.length === 0 ? (
        empty
      ) : (
        <ul className="divide-y divide-line">
          {results.map((r) => (
            <li key={`${r.examId}:${r.sectionId}`}>
              <Link href={`/admin/exams/${r.examId}/results/${r.sectionId}`} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6">
                <IconTile icon={Award} tone={r.kind === "EXAM" ? "violet" : "sky"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{r.examName}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.section} · published {publishedDate.format(r.publishedAt)} by {r.publishedBy}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-accent-text">
                  <span className="hidden sm:inline">View results</span>
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ───────────────────────── Activity ───────────────────────── */

export type Activity = { key: string; at: Date; icon: LucideIcon; tone: IconTone; title: string; text: string; href: string };

export function ActivityCard({ activities, emptyText, className }: { activities: Activity[]; emptyText: string; className?: string }) {
  const now = new Date();
  return (
    <Card title="Recent activity" icon={History} padded={false} className={className}>
      {activities.length === 0 ? (
        <EmptyState compact icon={History} title="No activity yet" description={emptyText} />
      ) : (
        <ul className="divide-y divide-line">
          {activities.map((a) => (
            <li key={a.key}>
              <Link href={a.href} className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6">
                <IconTile icon={a.icon} tone={a.tone} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{a.title}</span>
                  <span className="block truncate text-xs text-fg-2">{a.text}</span>
                  <span className="block text-[11px] text-subtle">{timeAgo(a.at, now)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function timeAgo(at: Date, now: Date) {
  const mins = Math.round((now.getTime() - at.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(at);
}

/** "Wednesday, 30 September 2026", in India. */
export function longToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(now);
}

/** A date chip for page headers. */
export function DateChip({ children }: { children: ReactNode }) {
  return (
    <span className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-fg-2 shadow-card sm:inline-flex">
      <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
      {children}
    </span>
  );
}
