import Link from "next/link";
import {
  Banknote,
  BookOpen,
  Bus,
  CalendarCheck,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  LogIn,
  Megaphone,
  PiggyBank,
  Plane,
  Presentation,
  Search,
  Settings,
  UserCog,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Pagination } from "@/components/pagination";
import { Card, EmptyState, IconTile, PageHeader, StatCard, StatGrid, inputClass, selectClass, type IconTone } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/lib/activity";
import { addDays, parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { getCurrentSchool } from "@/lib/school";

const META: Record<ActivityCategory | "Other", { icon: LucideIcon; tone: IconTone }> = {
  Students: { icon: GraduationCap, tone: "indigo" },
  Teachers: { icon: Presentation, tone: "emerald" },
  Staff: { icon: UserCog, tone: "sky" },
  Classes: { icon: BookOpen, tone: "violet" },
  Attendance: { icon: CalendarCheck, tone: "teal" },
  Leave: { icon: Plane, tone: "violet" },
  Fees: { icon: Wallet, tone: "amber" },
  Payroll: { icon: Banknote, tone: "emerald" },
  Expenses: { icon: PiggyBank, tone: "rose" },
  Exams: { icon: ClipboardList, tone: "indigo" },
  Notices: { icon: Megaphone, tone: "teal" },
  Transport: { icon: Bus, tone: "amber" },
  Timetable: { icon: CalendarClock, tone: "sky" },
  Calendar: { icon: CalendarDays, tone: "violet" },
  Documents: { icon: FileText, tone: "slate" },
  Settings: { icon: Settings, tone: "slate" },
  "Sign-in": { icon: LogIn, tone: "slate" },
  Other: { icon: History, tone: "slate" },
};

const dayTitle = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const timeOf = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
/** The start of an IST day as a UTC instant. */
const istStart = (iso: string) => new Date(`${iso}T00:00:00+05:30`);

/** What happened in the school, when, and who did it: newest first, by day, with filters. */
export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const sp = await searchParams;
  const school = await getCurrentSchool();
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const category = ACTIVITY_CATEGORIES.find((c) => c === pick("category")) ?? null;
  const q = pick("q").slice(0, 80);
  const who = pick("who").slice(0, 120);
  const from = parseISODate(pick("from")) ? pick("from") : "";
  const to = parseISODate(pick("to")) ? pick("to") : "";
  const today = todayISO();

  const base: Prisma.AuditLogWhereInput = { schoolId: school.id };
  const where: Prisma.AuditLogWhereInput = {
    ...base,
    ...(category && { category }),
    ...(who && { actor: who }),
    ...((from || to) && { createdAt: { ...(from && { gte: istStart(from) }), ...(to && { lt: istStart(addDays(to, 1)) }) } }),
    ...(q && {
      AND: q
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => ({ OR: [{ action: { contains: w, mode: "insensitive" as const } }, { details: { contains: w, mode: "insensitive" as const } }, { actor: { contains: w, mode: "insensitive" as const } }] })),
    }),
  };

  const [total, byCategory, actors, todayCount, weekCount, failed] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["category"], where: { ...where, category: undefined }, _count: true }),
    db.auditLog.groupBy({ by: ["actor"], where: { ...base, actor: { not: null } }, _count: true, orderBy: { _count: { actor: "desc" } }, take: 60 }),
    db.auditLog.count({ where: { ...base, createdAt: { gte: istStart(today) } } }),
    db.auditLog.count({ where: { ...base, createdAt: { gte: istStart(addDays(today, -6)) } } }),
    db.auditLog.count({ where: { ...base, category: "Sign-in", action: { contains: "failed" }, createdAt: { gte: istStart(addDays(today, -6)) } } }),
  ]);
  const paging = paginate(sp, total, 30);
  const entries = await db.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: paging.skip, take: paging.take });

  // Entries by IST day, in order.
  const days: { day: string; items: typeof entries }[] = [];
  for (const e of entries) {
    const day = istDate.format(e.createdAt);
    const last = days.at(-1);
    if (last?.day === day) last.items.push(e);
    else days.push({ day, items: [e] });
  }
  const counts = new Map(byCategory.map((c) => [c.category, c._count]));
  const href = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const current: Record<string, string> = { category: category ?? "", q, who, from, to };
    for (const [k, v] of Object.entries({ ...current, ...changes })) if (v) params.set(k, v);
    const s = params.toString();
    return `/admin/activity${s ? `?${s}` : ""}`;
  };
  const filtered = !!(category || q || who || from || to);

  return (
    <>
      <PageHeader title="Activity log" subtitle="What happened in the school, when, and who did it. Newest first." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Activity log" }]} />

      <div className="mb-6">
        <StatGrid cols={3}>
          <StatCard icon={History} tone="indigo" label="Today" value={todayCount} detail="Actions recorded today" />
          <StatCard icon={CalendarDays} tone="sky" label="Last 7 days" value={weekCount} detail="Across everyone" />
          <StatCard
            icon={LogIn}
            tone={failed ? "rose" : "emerald"}
            label="Failed sign-ins"
            value={failed}
            detail={failed ? "In the last 7 days" : "None in the last 7 days"}
            href={failed ? href({ category: "Sign-in", q: "failed", who: null }) : undefined}
          />
        </StatGrid>
      </div>

      <Card padded={false}>
        {/* Filters: a plain GET form, so the list is linkable and works without JavaScript. */}
        <form action="/admin/activity" className="grid gap-3 border-b border-line px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_14rem_10rem_10rem_auto]">
          {category && <input type="hidden" name="category" value={category} />}
          <label className="relative">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input name="q" defaultValue={q} placeholder="Search, e.g. a name, receipt or class" className={`${inputClass} !pl-9`} />
          </label>
          <label>
            <span className="sr-only">Who</span>
            <select name="who" defaultValue={who} className={selectClass}>
              <option value="">Everyone</option>
              {actors.map((a) => (
                <option key={a.actor} value={a.actor!}>
                  {a.actor}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            From
            <input type="date" name="from" defaultValue={from} max={today} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            To
            <input type="date" name="to" defaultValue={to} max={today} className={inputClass} />
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg shadow-accent transition hover:bg-accent-hover">
              Apply
            </button>
            {filtered && (
              <Link href="/admin/activity" className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
                <X className="h-4 w-4" /> Clear
              </Link>
            )}
          </div>
        </form>

        <nav aria-label="Areas" className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3 sm:px-6">
          <Link
            href={href({ category: null })}
            aria-current={!category ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${!category ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
          >
            All
          </Link>
          {ACTIVITY_CATEGORIES.filter((c) => counts.get(c) || c === category).map((c) => (
            <Link
              key={c}
              href={href({ category: c })}
              aria-current={category === c ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${category === c ? "bg-accent text-white" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
            >
              {c} <span className="tabular-nums opacity-75">{counts.get(c) ?? 0}</span>
            </Link>
          ))}
        </nav>

        {entries.length === 0 ? (
          <EmptyState icon={History} title={filtered ? "Nothing matches" : "No activity yet"} description={filtered ? "Try another search, person, area or dates." : "Actions taken in the school will show here."} />
        ) : (
          <div className="divide-y divide-line">
            {days.map((d) => (
              <section key={d.day}>
                <h2 className="sticky top-0 z-10 bg-surface-2/95 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted backdrop-blur sm:px-6">
                  {d.day === today ? "Today" : d.day === addDays(today, -1) ? "Yesterday" : dayTitle.format(istStart(d.day))}
                </h2>
                <ol className="divide-y divide-line">
                  {d.items.map((e) => {
                    const meta = META[(e.category as ActivityCategory) ?? "Other"] ?? META.Other;
                    const failedEntry = /failed/i.test(e.action);
                    return (
                      <li key={e.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
                        <IconTile icon={meta.icon} tone={failedEntry ? "rose" : meta.tone} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${failedEntry ? "text-danger" : "text-fg"}`}>{e.action}</p>
                          {e.details && <p className="mt-0.5 text-xs text-muted">{e.details}</p>}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                            {e.actor ? (
                              <Link href={href({ who: e.actor })} className="font-medium text-fg-2 hover:text-accent-text">
                                {e.actor}
                              </Link>
                            ) : (
                              <span>System</span>
                            )}
                            {e.category && (
                              <>
                                <span aria-hidden>·</span>
                                <Link href={href({ category: e.category })} className="hover:text-accent-text">
                                  {e.category}
                                </Link>
                              </>
                            )}
                          </p>
                        </div>
                        <time dateTime={e.createdAt.toISOString()} className="shrink-0 text-xs tabular-nums text-muted">
                          {timeOf.format(e.createdAt)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
        <Pagination paging={paging} noun="entries" />
      </Card>
    </>
  );
}
