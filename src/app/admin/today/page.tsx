import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpenText,
  Cake,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  History,
  IndianRupee,
  type LucideIcon,
  Megaphone,
  Newspaper,
  Plane,
  Presentation,
  Receipt,
  Sparkles,
  TrendingDown,
  UserPlus,
  UserRoundCheck,
  Users,
  Wallet,
} from "lucide-react";
import { DateNav } from "@/components/attendance/date-nav";
import { ActivityFeed, ClassBoard, FeesPanel, PeopleTabs, type PeopleGroup, type PersonRow } from "@/components/daily-report/report-panels";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, cx } from "@/components/ui";
import { parseISODate } from "@/lib/attendance-shared";
import type { DayRoster } from "@/lib/attendance-day";
import { loadDailyReport } from "@/lib/daily-report";
import { CATEGORY_LABELS, CATEGORY_SHORT, APPLICANT_LABELS, STATUS_LABELS, STATUS_TONES } from "@/lib/leave-shared";
import { KIND_META } from "@/lib/materials-shared";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { getCurrentSchool } from "@/lib/school";
import { attendanceWindow } from "@/lib/attendance";
import { formatTime } from "@/lib/timetable-shared";

const longDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : null);

const SECTIONS = [
  { id: "attendance", label: "Attendance" },
  { id: "staff", label: "People" },
  { id: "fees", label: "Fees" },
  { id: "money-out", label: "Money out" },
  { id: "academics", label: "Academics" },
  { id: "leave", label: "Leave & admissions" },
  { id: "activity", label: "Activity" },
];

/** Who in a day roster is away or unmarked, as person rows for the tabs. */
function away(roster: DayRoster, opts: { unmarked: boolean }): PersonRow[] {
  const out: PersonRow[] = [];
  for (const p of roster.people) {
    const tag =
      p.mark === "ABSENT"
        ? "Absent"
        : p.leave || p.mark === "LEAVE"
          ? p.leave
            ? `Leave · ${CATEGORY_SHORT[p.leave.category]}`
            : "Leave"
          : p.mark === "LATE"
            ? "Late"
            : p.mark === "HALF_DAY"
              ? "Half day"
              : !p.mark && opts.unmarked
                ? "Not marked"
                : null;
    if (!tag) continue;
    const tone = tag === "Absent" ? "red" : tag === "Late" || tag === "Half day" ? "amber" : tag === "Not marked" ? "slate" : "indigo";
    out.push({ id: p.id, name: p.name, sub: p.sub, href: p.href, photoUrl: p.photoUrl, tag, tone });
  }
  const order = { Absent: 0, "Not marked": 3 } as Record<string, number>;
  return out.sort((a, b) => (order[a.tag] ?? 1) - (order[b.tag] ?? 1));
}

/** "Today's report": everything that happened in the school on one day. */
export default async function TodayReportPage({ searchParams }: PageProps<"/admin/today">) {
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const raw = (await searchParams).date;
  const date = typeof raw === "string" && parseISODate(raw) && raw >= win.min && raw <= win.today ? raw : win.today;
  const r = await loadDailyReport(school.id, date);
  const day = longDate.format(parseISODate(date)!);
  const closed = !!r.offName;

  const s = r.students.counts;
  const studentsMarked = r.students.marked;
  const studentPct = pct(s.present, s.present + s.absent);
  const teachersPresent = r.teaching.counts.present;
  const staffPresent = r.nonTeaching.counts.present;
  const moneyOut = r.expenses.total + r.salaries.total;
  const lowClasses = r.classes.filter((c) => c.status === "taken" && c.percent != null && c.percent < 75);
  const mostAbsent = [...r.classes].filter((c) => c.status === "taken").sort((a, b) => b.absent - a.absent)[0];

  // What deserves the admin's attention, most urgent first.
  const highlights: { tone: "danger" | "warning" | "good" | "info"; icon: LucideIcon; text: ReactNode; href?: string }[] = [];
  if (closed) highlights.push({ tone: "info", icon: CalendarOff, text: <>School closed: {r.offName}.</> });
  if (!closed && r.attendance.notTaken)
    highlights.push({
      tone: "danger",
      icon: AlertTriangle,
      text: (
        <>
          {r.attendance.notTaken} of {r.attendance.sections} classes {r.isToday ? "haven\u2019t taken" : "didn\u2019t take"} attendance.
        </>
      ),
      href: "#attendance",
    });
  if (!closed && !r.attendance.notTaken && r.attendance.taken)
    highlights.push({ tone: "good", icon: BadgeCheck, text: <>Every class has taken attendance.</> });
  if (lowClasses.length)
    highlights.push({
      tone: "warning",
      icon: TrendingDown,
      text: (
        <>
          {lowClasses.length} class{lowClasses.length === 1 ? "" : "es"} below 75%:{" "}
          {lowClasses
            .slice(0, 3)
            .map((c) => c.label)
            .join(", ")}
          {lowClasses.length > 3 ? "…" : ""}.
        </>
      ),
      href: "#attendance",
    });
  if (mostAbsent?.absent)
    highlights.push({
      tone: "info",
      icon: Users,
      text: (
        <>
          Most absences in {mostAbsent.label}: {mostAbsent.absent} of {mostAbsent.strength}.
        </>
      ),
    });
  if (!closed && r.teaching.counts.unmarked)
    highlights.push({
      tone: "warning",
      icon: Presentation,
      text: (
        <>
          {r.teaching.counts.unmarked} teacher{r.teaching.counts.unmarked === 1 ? "" : "s"} not marked yet.
        </>
      ),
      href: "#staff",
    });
  if (r.fees.cancelled.length)
    highlights.push({
      tone: "warning",
      icon: Receipt,
      text: (
        <>
          {r.fees.cancelled.length} fee receipt{r.fees.cancelled.length === 1 ? " was" : "s were"} cancelled.
        </>
      ),
      href: "#fees",
    });
  if (r.fees.count)
    highlights.push({
      tone: "good",
      icon: IndianRupee,
      text: (
        <>
          {rupees(r.fees.total)} collected in {r.fees.count} receipt{r.fees.count === 1 ? "" : "s"}.
        </>
      ),
      href: "#fees",
    });
  if (r.admissions.length)
    highlights.push({
      tone: "good",
      icon: UserPlus,
      text: (
        <>
          {r.admissions.length} new admission{r.admissions.length === 1 ? "" : "s"}.
        </>
      ),
      href: "#leave",
    });
  if (r.birthdays.length)
    highlights.push({
      tone: "info",
      icon: Cake,
      text: (
        <>
          {r.birthdays.length} birthday{r.birthdays.length === 1 ? "" : "s"} today.
        </>
      ),
      href: "#staff",
    });

  const peopleGroups: PeopleGroup[] = [
    {
      key: "students",
      label: "Students away",
      people: away(r.students, { unmarked: false }).filter((p) => p.tag !== "Late" && p.tag !== "Half day"),
      empty: closed ? "No school on this day." : "No student is absent or on leave.",
      action: s.absent ? { href: `/admin/notices?absent=${date}`, label: `Message ${s.absent} absent students' parents` } : undefined,
    },
    {
      key: "late",
      label: "Late / half day",
      people: away(r.students, { unmarked: false }).filter((p) => p.tag === "Late" || p.tag === "Half day"),
      empty: "No one came late.",
    },
    { key: "teachers", label: "Teachers", people: away(r.teaching, { unmarked: !closed }), empty: "Every teacher is present." },
    { key: "staff", label: "Non-teaching staff", people: away(r.nonTeaching, { unmarked: !closed }), empty: "All staff are present." },
    {
      key: "birthdays",
      label: "Birthdays",
      people: r.birthdays.map((b) => ({ id: b.id, name: b.name, sub: b.sub, href: b.href, photoUrl: null, tag: "🎂 Birthday", tone: "sky" as const })),
      empty: "No birthdays on this day.",
    },
  ];

  return (
    <>
      <style>{"@media print { nav[aria-label='Report sections'], .print-hide { display: none !important; } }"}</style>

      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 p-6 text-white shadow-lift sm:p-8 print:bg-none print:p-0 print:text-fg print:shadow-none">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-400/15 blur-2xl print:hidden" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-400/10 blur-2xl print:hidden" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200 print:text-muted">
              <Newspaper className="h-4 w-4" /> {r.isToday ? "Today's report" : "Day report"} · {school.name}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{day}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
              {closed ? (
                <span className="rounded-full bg-amber-400/20 px-3 py-1 text-amber-100 ring-1 ring-amber-300/30">Closed · {r.offName}</span>
              ) : (
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-100 ring-1 ring-emerald-300/30">School day</span>
              )}
              {r.isToday && <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">Live · updates as the day goes on</span>}
              {r.proxies > 0 && (
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">
                  {r.proxies} proxy period{r.proxies === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <div className="print-hide flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-2 text-fg shadow-lift ring-1 ring-white/20">
            <DateNav basePath="/admin/today" date={date} min={r.min} max={r.today} />
            <PrintButton label="Print" />
          </div>
        </div>

        {/* Headline numbers */}
        <div className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <HeroStat
            label="Students present"
            value={closed ? "—" : studentPct == null ? "—" : `${studentPct}%`}
            sub={closed ? "No school" : studentsMarked ? `${s.present} of ${r.students.total} · ${s.absent} absent` : "No attendance yet"}
            meter={studentPct}
          />
          <HeroStat
            label="Attendance taken"
            value={closed ? "—" : `${r.attendance.taken}/${r.attendance.sections}`}
            sub={
              closed
                ? "No school"
                : r.attendance.notTaken
                  ? `${r.attendance.notTaken} class${r.attendance.notTaken === 1 ? "" : "es"} pending`
                  : "All classes done"
            }
            meter={closed ? null : pct(r.attendance.taken, r.attendance.sections)}
            alert={!closed && r.attendance.notTaken > 0}
          />
          <HeroStat
            label="Fees collected"
            value={rupees(r.fees.total)}
            sub={`${r.fees.count} receipt${r.fees.count === 1 ? "" : "s"}${r.fees.byMode[0] ? ` · mostly ${MODE_LABELS[r.fees.byMode[0].mode as keyof typeof MODE_LABELS] ?? r.fees.byMode[0].mode}` : ""}`}
          />
          <HeroStat
            label="Staff present"
            value={closed ? "—" : `${teachersPresent + staffPresent}/${r.teaching.total + r.nonTeaching.total}`}
            sub={closed ? "No school" : `${teachersPresent}/${r.teaching.total} teachers · ${staffPresent}/${r.nonTeaching.total} staff`}
            meter={closed ? null : pct(teachersPresent + staffPresent, r.teaching.total + r.nonTeaching.total)}
          />
        </div>
      </section>

      {/* Secondary numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MiniStat icon={Users} tone="rose" label="Students absent" value={closed ? "—" : s.absent} href="#staff" />
        <MiniStat icon={Plane} tone="violet" label="On leave" value={s.leave + r.teaching.counts.leave + r.nonTeaching.counts.leave} href="#staff" />
        <MiniStat icon={Wallet} tone="amber" label="Money out" value={rupees(moneyOut)} href="#money-out" />
        <MiniStat icon={ClipboardList} tone="sky" label="Exam papers" value={r.papers.length} href="#academics" />
        <MiniStat icon={UserPlus} tone="emerald" label="Admissions" value={r.admissions.length} href="#leave" />
        <MiniStat icon={Megaphone} tone="teal" label="Notices sent" value={r.notices.length} href="#academics" />
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <Card title="Highlights" icon={Sparkles} className="mb-6" description="What stands out, most urgent first.">
          <ul className="grid gap-2 md:grid-cols-2">
            {highlights.map((h, i) => {
              const tone = {
                danger: "bg-danger-soft text-danger ring-danger-line",
                warning: "bg-warning-soft text-warning ring-warning-line",
                good: "bg-success-soft text-success ring-success-line",
                info: "bg-surface-2 text-fg-2 ring-line",
              }[h.tone];
              const body = (
                <>
                  <h.icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm text-fg">{h.text}</span>
                </>
              );
              return (
                <li key={i}>
                  {h.href ? (
                    <a href={h.href} className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 ring-inset transition hover:brightness-95", tone)}>
                      {body}
                    </a>
                  ) : (
                    <p className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 ring-inset", tone)}>{body}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Section menu */}
      <nav
        aria-label="Report sections"
        className="sticky top-[3.25rem] z-20 -mx-4 mb-6 flex gap-1 overflow-x-auto border-y border-line bg-glass px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 md:top-0 lg:-mx-10 lg:px-10"
      >
        {SECTIONS.map((x) => (
          <a
            key={x.id}
            href={`#${x.id}`}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-fg-2 transition hover:bg-surface-2 hover:text-accent-text"
          >
            {x.label}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        <Card
          id="attendance"
          className="scroll-mt-24"
          title="Class attendance"
          icon={CalendarCheck}
          description={closed ? `No school: ${r.offName}` : `${r.attendance.taken} of ${r.attendance.sections} classes taken · hover a bar for numbers`}
          padded={false}
        >
          <ClassBoard classes={r.classes} date={date} dayLabel={r.isToday ? "today" : shortDate.format(parseISODate(date)!)} closed={closed} live={r.isToday} />
        </Card>

        <Card
          id="staff"
          className="scroll-mt-24"
          title="People"
          icon={UserRoundCheck}
          description="Who was away, late or not marked, and birthdays"
          padded={false}
        >
          <PeopleTabs groups={peopleGroups} />
        </Card>

        <Card
          id="fees"
          className="scroll-mt-24"
          title="Fees collected"
          icon={IndianRupee}
          description={r.fees.count ? `${rupees(r.fees.total)} in ${r.fees.count} receipt${r.fees.count === 1 ? "" : "s"} · click a mode to filter` : undefined}
          padded={false}
        >
          <FeesPanel fees={r.fees} />
          {r.fees.cancelled.length > 0 && (
            <div className="border-t border-line bg-danger-soft/40 px-4 py-3 sm:px-6">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-danger">Cancelled on this day</p>
              <ul className="space-y-1 text-sm">
                {r.fees.cancelled.map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2">
                    <span className="text-fg">
                      #{c.number} · {c.studentName}
                      <span className="text-muted">
                        {" "}
                        · by {c.cancelledBy ?? "—"}
                        {c.cancelReason ? ` · “${c.cancelReason}”` : ""}
                      </span>
                    </span>
                    <span className="tabular-nums text-danger line-through">{rupees(c.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div id="money-out" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
          <Card
            title="Expenses"
            icon={Wallet}
            description={r.expenses.list.length ? `${rupees(r.expenses.total)} in ${r.expenses.list.length} entries` : undefined}
            padded={false}
            action={
              <Link href="/admin/expenses" className="text-sm font-medium text-accent-text">
                Expenses
              </Link>
            }
          >
            <SimpleList
              empty="No expenses on this day."
              rows={r.expenses.list.map((e) => ({
                key: e.id,
                title: e.category,
                sub: [e.paidTo, e.description, MODE_LABELS[e.mode]].filter(Boolean).join(" · "),
                right: rupees(e.amount),
              }))}
            />
          </Card>
          <Card
            title="Salaries paid"
            icon={Presentation}
            description={r.salaries.list.length ? `${rupees(r.salaries.total)} to ${r.salaries.list.length} people` : undefined}
            padded={false}
            action={
              <Link href="/admin/payroll" className="text-sm font-medium text-accent-text">
                Payroll
              </Link>
            }
          >
            <SimpleList
              empty="No salaries paid on this day."
              rows={r.salaries.list.map((p) => ({
                key: p.id,
                title: p.name,
                sub: `${p.role} · for ${p.month}`,
                right: rupees(p.amount),
                href: `/admin/payslips/${p.id}`,
              }))}
            />
          </Card>
        </div>

        <div id="academics" className="grid scroll-mt-24 gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <Card title="Exams & tests" icon={ClipboardList} padded={false}>
            <SimpleList
              empty="No papers on this day."
              rows={r.papers.map((p) => ({
                key: p.id,
                title: p.name,
                sub: `${p.exam} · ${p.classes} · ${formatTime(p.startTime)}`,
                href: `/admin/exams/${p.examId}`,
                badge: p.kind === "EXAM" ? "Exam" : "Test",
              }))}
            />
          </Card>
          <Card title="Results published" icon={FileBarChart} padded={false}>
            <SimpleList
              empty="No results published."
              rows={r.results.map((x) => ({ key: x.key, title: x.exam, sub: `${x.section} · by ${x.by}`, href: `/admin/results/${x.examId}/${x.sectionId}` }))}
            />
          </Card>
          <Card title="Notices sent" icon={Megaphone} padded={false}>
            <SimpleList
              empty="No notices sent."
              rows={r.notices.map((n) => ({ key: n.id, title: n.title, sub: `${n.audience} · ${n.sentBy}`, href: `/admin/notices/${n.id}` }))}
            />
          </Card>
          <Card title="Study material" icon={BookOpenText} padded={false}>
            <SimpleList
              empty="Nothing posted."
              rows={r.materials.map((m) => ({
                key: m.id,
                title: m.title,
                sub: [m.where, m.subject, m.by.replace(/ \(.*\)$/, "")].filter(Boolean).join(" · "),
                badge: KIND_META[m.kind].label,
              }))}
            />
          </Card>
        </div>

        <div id="leave" className="grid scroll-mt-24 gap-6 lg:grid-cols-3">
          <Card
            title="Leave requests"
            icon={Plane}
            description={`${r.leave.submitted.length} new · ${r.leave.decided} decided`}
            padded={false}
            className="lg:col-span-2"
            action={
              <Link href="/admin/leave" className="text-sm font-medium text-accent-text">
                Leave
              </Link>
            }
          >
            <SimpleList
              empty="No new leave requests."
              rows={r.leave.submitted.map((l) => ({
                key: l.id,
                title: l.name,
                sub: `${APPLICANT_LABELS[l.applicant]} · ${CATEGORY_LABELS[l.category]} · ${l.from === l.to ? shortDate.format(parseISODate(l.from)!) : `${shortDate.format(parseISODate(l.from)!)} – ${shortDate.format(parseISODate(l.to)!)}`}`,
                badge: STATUS_LABELS[l.status],
                badgeTone: STATUS_TONES[l.status],
                href: `/admin/leave?status=all&open=${l.id}`,
              }))}
            />
          </Card>
          <Card title="New admissions" icon={GraduationCap} padded={false}>
            <SimpleList
              empty="No new students."
              rows={r.admissions.map((a) => ({ key: a.id, title: a.name, sub: `${a.section} · ${a.code}`, href: `/admin/students/${a.id}` }))}
            />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            id="activity"
            title="Activity"
            icon={History}
            description={`${r.activity.length} thing${r.activity.length === 1 ? "" : "s"} logged`}
            padded={false}
            className="scroll-mt-24 lg:col-span-2"
          >
            <ActivityFeed items={r.activity} />
          </Card>
          <Card title={r.isToday ? "Coming up tomorrow" : "The next day"} icon={CalendarClock}>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted">{shortDate.format(parseISODate(r.tomorrow.date)!)}</span>
                {r.tomorrow.holiday ? <Badge tone="sky">Closed · {r.tomorrow.holiday}</Badge> : <Badge tone="green">School day</Badge>}
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted">Exam papers</span>
                <span className="font-semibold tabular-nums text-fg">{r.tomorrow.papers}</span>
              </li>
              {r.events.filter((e) => e.end >= r.tomorrow.date).length === 0 ? (
                <li className="text-muted">No events planned.</li>
              ) : (
                r.events
                  .filter((e) => e.end >= r.tomorrow.date)
                  .map((e) => (
                    <li key={e.id} className="rounded-xl bg-surface-2 px-3 py-2">
                      <span className="block font-medium text-fg">{e.title}</span>
                      <span className="block text-xs text-muted">
                        {e.start === e.end
                          ? shortDate.format(parseISODate(e.start)!)
                          : `${shortDate.format(parseISODate(e.start)!)} – ${shortDate.format(parseISODate(e.end)!)}`}
                      </span>
                    </li>
                  ))
              )}
              <li>
                <Link href="/admin/calendar" className="text-xs font-medium text-accent-text hover:underline">
                  School calendar →
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

/** A headline number on the hero, with an optional meter. */
function HeroStat({ label, value, sub, meter, alert }: { label: string; value: string; sub: string; meter?: number | null; alert?: boolean }) {
  return (
    <div className={cx("rounded-2xl bg-white/[0.07] p-4 ring-1 backdrop-blur print:bg-surface print:ring-line", alert ? "ring-rose-300/50" : "ring-white/15")}>
      <p className="text-xs font-medium text-indigo-100/80 print:text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-0.5 truncate text-xs text-indigo-100/70 print:text-muted">{sub}</p>
      {meter != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15 print:bg-surface-3">
          <div
            className={cx("h-full rounded-full", meter >= 90 ? "bg-emerald-400" : meter >= 75 ? "bg-amber-400" : "bg-rose-400")}
            style={{ width: `${Math.min(100, meter)}%` }}
          />
        </div>
      )}
    </div>
  );
}

const MINI_TONES = {
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
} as const;

function MiniStat({
  icon: Icon,
  tone,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  tone: keyof typeof MINI_TONES;
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", MINI_TONES[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-bold tabular-nums text-fg">{value}</span>
        <span className="block truncate text-xs text-muted">{label}</span>
      </span>
    </a>
  );
}

type Row = {
  key: string;
  title: string;
  sub?: string;
  right?: string;
  href?: string;
  badge?: string;
  badgeTone?: "slate" | "green" | "red" | "amber" | "indigo" | "sky";
};

/** A compact list for a report card. */
function SimpleList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="px-5 py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="max-h-80 divide-y divide-line overflow-y-auto">
      {rows.map((x) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{x.title}</span>
              {x.sub && <span className="block truncate text-xs text-muted">{x.sub}</span>}
            </span>
            {x.badge && <Badge tone={x.badgeTone ?? "slate"}>{x.badge}</Badge>}
            {x.right && <span className="font-semibold tabular-nums text-fg">{x.right}</span>}
          </>
        );
        return (
          <li key={x.key}>
            {x.href ? (
              <Link href={x.href} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-surface-2">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-5 py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
