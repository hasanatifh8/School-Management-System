import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Cake,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  GraduationCap,
  History,
  IdCard,
  IndianRupee,
  Megaphone,
  Presentation,
  Receipt,
  Rocket,
  Sun,
  TriangleAlert,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AttendanceChart, type ClassAttendance } from "@/components/dashboard/attendance-chart";
import { FeeTrendChart } from "@/components/dashboard/fee-trend-chart";
import { AnimatedNumber, Avatar, ButtonLink, Callout, Card, EmptyState, IconTile, PageHeader, TextLink, type IconTone } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { db } from "@/lib/db";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSession, getUpcomingSession, pendingPromotions } from "@/lib/sessions";
import { attendanceWindow } from "@/lib/attendance";
import { attendancePercent, emptyCounts, isSunday, parseISODate } from "@/lib/attendance-shared";
import { loadCalendar } from "@/lib/calendar";
import { EVENT_META } from "@/lib/calendar-shared";
import { monthlyFeeTrend } from "@/lib/fees";
import { rupees } from "@/lib/fees-shared";

const DAY = 86_400_000;
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function DashboardPage() {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  const active = { schoolId: school.id, status: "ACTIVE" as const };
  const [session, upcoming] = await Promise.all([getCurrentSession(school.id), getUpcomingSession(school.id)]);
  const pending = upcoming ? await pendingPromotions(school.id, session.id) : [];

  const win = await attendanceWindow(school.id);
  const todayDate = parseISODate(win.today)!;
  const attendanceDue = win.today === win.max && !isSunday(win.today);

  const [
    studentCount,
    teacherCount,
    staffCount,
    feesToday,
    feeHeadCount,
    classes,
    unassignedStudents,
    sectionsWithoutTeacher,
    todayHoliday,
    todayDays,
    todayRecords,
    birthdayStudents,
    birthdayTeachers,
    calendar,
    recentStudents,
    recentReceipts,
    recentTeachers,
    recentNotices,
    recentResults,
  ] = await Promise.all([
    db.student.count({ where: active }),
    db.teacher.count({ where: active }),
    db.staffMember.count({ where: active }),
    db.feeReceipt.aggregate({ where: { schoolId: school.id, cancelledAt: null, date: todayDate }, _sum: { total: true }, _count: true }),
    db.feeHead.count({ where: { sessionId: session.id } }),
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        sections: { orderBy: { name: "asc" }, include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } },
      },
    }),
    db.student.count({ where: { ...active, sectionId: null } }),
    db.section.count({ where: { class: { schoolId: school.id }, classTeacherId: null } }),
    attendanceDue ? db.holiday.findUnique({ where: { schoolId_date: { schoolId: school.id, date: todayDate } } }) : null,
    attendanceDue ? db.attendanceDay.findMany({ where: { schoolId: school.id, date: todayDate }, select: { sectionId: true } }) : [],
    attendanceDue
      ? db.attendanceRecord.findMany({
          where: { day: { schoolId: school.id, date: todayDate, holiday: null }, student: { status: "ACTIVE" } },
          select: { status: true, day: { select: { section: { select: { classId: true } } } } },
        })
      : [],
    db.student.findMany({
      where: { ...active, dateOfBirth: { not: null } },
      select: { id: true, firstName: true, middleName: true, lastName: true, dateOfBirth: true, photoId: true, section: { include: { class: true } } },
    }),
    db.teacher.findMany({
      where: { ...active, dateOfBirth: { not: null } },
      select: { id: true, firstName: true, middleName: true, lastName: true, dateOfBirth: true, photoId: true },
    }),
    loadCalendar(school.id, session, { links: "admin" }),
    db.student.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: "desc" }, take: 4, include: { section: { include: { class: true } } } }),
    db.feeReceipt.findMany({ where: { schoolId: school.id, cancelledAt: null }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.teacher.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.notice.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.examResult.findMany({
      where: { exam: { schoolId: school.id } },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: { exam: { select: { id: true, name: true } }, section: { include: { class: true } } },
    }),
  ]);
  const feeTrend = feeHeadCount ? await monthlyFeeTrend(school.id) : [];

  /* ── Today's attendance ── */
  const sectionsWithStudents = classes.flatMap((c) => c.sections.map((s) => ({ ...s, class: c }))).filter((s) => s._count.students > 0);
  const takenToday = new Set(todayDays.map((d) => d.sectionId));
  const attendanceOpen = attendanceDue && !todayHoliday;
  const toMark = attendanceOpen ? sectionsWithStudents.filter((s) => !takenToday.has(s.id)) : [];
  const counts = emptyCounts();
  const byClass = new Map<string, ClassAttendance>();
  for (const r of todayRecords) {
    counts[r.status]++;
    const classId = r.day.section.classId;
    const c = byClass.get(classId) ?? { id: classId, name: "", present: 0, absent: 0, leave: 0 };
    if (r.status === "ABSENT") c.absent++;
    else if (r.status === "LEAVE") c.leave++;
    else c.present++;
    byClass.set(classId, c);
  }
  const attendanceChart = classes.filter((c) => byClass.has(c.id)).map((c) => ({ ...byClass.get(c.id)!, name: c.name }));
  const marked = todayRecords.length;
  const presentCount = counts.PRESENT + counts.LATE + counts.HALF_DAY;
  const presentPct = attendancePercent(counts);
  const absentPct = marked ? Math.round((counts.ABSENT / marked) * 1000) / 10 : null;

  /* ── Birthdays in the next 30 days ── */
  const todayMs = todayDate.getTime();
  const daysToBirthday = (dob: Date) => {
    const y = todayDate.getUTCFullYear();
    let next = Date.UTC(y, dob.getUTCMonth(), dob.getUTCDate());
    if (next < todayMs) next = Date.UTC(y + 1, dob.getUTCMonth(), dob.getUTCDate());
    return { days: Math.round((next - todayMs) / DAY), date: new Date(next) };
  };
  const birthdays = [
    ...birthdayStudents.map((s) => ({ id: s.id, href: `/admin/students/${s.id}`, name: fullName(s), photoId: s.photoId, sub: s.section ? sectionLabel(s.section) : "Student", ...daysToBirthday(s.dateOfBirth!) })),
    ...birthdayTeachers.map((t) => ({ id: t.id, href: `/admin/teachers/${t.id}`, name: fullName(t), photoId: t.photoId, sub: "Teacher", ...daysToBirthday(t.dateOfBirth!) })),
  ]
    .filter((b) => b.days <= 30)
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));

  /* ── Coming up on the school calendar ── */
  const events = calendar.items.filter((i) => i.end >= win.today).slice(0, 5);

  /* ── Recent activity ── */
  const activities: Activity[] = [
    ...recentStudents.map((s) => ({
      key: `s-${s.id}`,
      at: s.createdAt,
      icon: UserPlus,
      tone: "indigo" as const,
      title: "New admission",
      text: `${fullName(s)}${s.section ? ` (${sectionLabel(s.section)})` : ""}`,
      href: `/admin/students/${s.id}`,
    })),
    ...recentReceipts.map((r) => ({
      key: `r-${r.id}`,
      at: r.createdAt,
      icon: IndianRupee,
      tone: "emerald" as const,
      title: "Fee received",
      text: `${rupees(r.total)} from ${r.studentName} · ${r.number}`,
      href: `/admin/fees/receipts/${r.id}`,
    })),
    ...recentTeachers.map((t) => ({
      key: `t-${t.id}`,
      at: t.createdAt,
      icon: Presentation,
      tone: "violet" as const,
      title: "New teacher",
      text: `${fullName(t)}${t.specialization ? ` (${t.specialization})` : ""}`,
      href: `/admin/teachers/${t.id}`,
    })),
    ...recentNotices.map((n) => ({
      key: `n-${n.id}`,
      at: n.createdAt,
      icon: Megaphone,
      tone: "teal" as const,
      title: "Notice sent",
      text: `${n.title} · ${n.audience}`,
      href: `/admin/notices/${n.id}`,
    })),
    ...recentResults.map((r) => ({
      key: `x-${r.examId}-${r.sectionId}`,
      at: r.publishedAt,
      icon: BadgeCheck,
      tone: "amber" as const,
      title: "Results published",
      text: `${r.exam.name} · ${sectionLabel(r.section)}`,
      href: `/admin/exams/${r.exam.id}/results/${r.sectionId}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(now);
  const firstName = viewer?.kind === "admin" ? viewer.admin.name.split(/\s+/)[0] : "Admin";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${firstName}! Here's what's happening at ${school.name} today.`}
        action={
          <>
            <span className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-fg-2 shadow-card sm:inline-flex">
              <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
              {today}
              <span className="text-subtle">·</span>
              <span className="text-muted">Session {session.name}</span>
            </span>
            <ButtonLink href="/admin/students/new" icon={UserPlus}>
              New admission
            </ButtonLink>
          </>
        }
      />

      {upcoming && (
        <Callout
          icon={Rocket}
          href="/admin/sessions"
          className="mb-4"
          action={
            <span className="inline-flex items-center gap-1">
              Continue <ArrowRight className="h-4 w-4" />
            </span>
          }
        >
          <strong className="font-semibold">Promotion to {upcoming.name} is in progress.</strong>{" "}
          {pending.length ? `${pending.length} class(es) still to promote.` : `All classes are ready. Start ${upcoming.name} when you're ready.`}
        </Callout>
      )}

      {(toMark.length > 0 || unassignedStudents > 0 || sectionsWithoutTeacher > 0) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {toMark.length > 0 && (
            <AttentionChip href={`/admin/attendance/${toMark[0].id}?date=${win.today}`}>
              {toMark.length} class(es) haven&apos;t taken attendance today
            </AttentionChip>
          )}
          {unassignedStudents > 0 && <AttentionChip href="/admin/students">{unassignedStudents} student(s) without a class</AttentionChip>}
          {sectionsWithoutTeacher > 0 && <AttentionChip href="/admin/classes">{sectionsWithoutTeacher} section(s) without a class teacher</AttentionChip>}
        </div>
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard href="/admin/students" icon={GraduationCap} tone="indigo" label="Total students" value={studentCount} link="View students" />
        <KpiCard href="/admin/teachers" icon={Users} tone="emerald" label="Total teachers" value={teacherCount} link="View teachers" />
        <KpiCard href="/admin/staff" icon={Presentation} tone="amber" label="Total staff" value={staffCount} link="View staff" />
        <KpiCard
          href="/admin/attendance"
          icon={UserRoundCheck}
          tone="violet"
          label="Present today"
          value={attendanceOpen ? presentCount : null}
          badge={presentPct != null ? `${presentPct}%` : undefined}
          empty={todayHoliday ? "Holiday" : attendanceDue ? "Not marked" : "Day off"}
          link="View attendance"
        />
        <KpiCard
          href="/admin/attendance/register"
          icon={UserRoundX}
          tone="rose"
          label="Absent today"
          value={attendanceOpen ? counts.ABSENT : null}
          badge={absentPct != null ? `${absentPct}%` : undefined}
          empty={todayHoliday ? "Holiday" : attendanceDue ? "Not marked" : "Day off"}
          link="View register"
        />
        <KpiCard
          href="/admin/fees/receipts"
          icon={Wallet}
          tone="teal"
          label="Today's collection"
          value={feesToday._sum.total ?? 0}
          prefix="₹"
          badge={feesToday._count ? `${feesToday._count} receipt(s)` : undefined}
          link="View receipts"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title="Attendance overview"
          icon={CalendarCheck}
          description={
            attendanceOpen
              ? `Today · ${marked ? `${sectionsWithStudents.length - toMark.length} of ${sectionsWithStudents.length} sections marked` : "not marked yet"}`
              : "Today"
          }
          action={<TextLink href="/admin/attendance/register">View register</TextLink>}
        >
          {attendanceChart.length ? (
            <AttendanceChart data={attendanceChart} />
          ) : (
            <EmptyState
              compact
              icon={todayHoliday ? CalendarOff : attendanceDue ? CalendarCheck : Sun}
              title={todayHoliday ? `Holiday: ${todayHoliday.name}` : attendanceDue ? "No attendance marked yet today" : "No attendance today"}
              description={attendanceDue && !todayHoliday ? "Class-wise present and absent counts appear here once classes are marked." : "Enjoy the break."}
              action={
                toMark.length > 0 && (
                  <ButtonLink href={`/admin/attendance/${toMark[0].id}?date=${win.today}`} variant="secondary" size="sm">
                    Take attendance
                  </ButtonLink>
                )
              }
            />
          )}
        </Card>

        <Card
          title="Fee collection overview"
          icon={IndianRupee}
          description={
            feeTrend.length
              ? `Session ${session.name} · ${rupees(Math.max(0, feeTrend.at(-1)!.due - feeTrend.at(-1)!.collected))} pending so far`
              : `Session ${session.name}`
          }
          action={<TextLink href="/admin/fees">View fees</TextLink>}
        >
          {feeTrend.length ? (
            <FeeTrendChart data={feeTrend} />
          ) : (
            <EmptyState
              compact
              icon={Wallet}
              title="No fee structure yet"
              description="Set up the fees your school charges to track collections here."
              action={
                <ButtonLink href="/admin/fees/structure" variant="secondary" size="sm">
                  Set up fees
                </ButtonLink>
              }
            />
          )}
        </Card>
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Upcoming birthdays" icon={Cake} description="Next 30 days" padded={false}>
          {birthdays.length === 0 ? (
            <EmptyState compact icon={Cake} title="No birthdays soon" description="Birthdays of students and teachers show here." />
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

        <Card title="Upcoming exams & events" icon={CalendarDays} padded={false} action={<TextLink href="/admin/calendar">View calendar</TextLink>}>
          {events.length === 0 ? (
            <EmptyState
              compact
              icon={ClipboardList}
              title="Nothing scheduled"
              description="Plan exams, events and holidays on the school calendar."
              action={
                <ButtonLink href="/admin/calendar/new" variant="secondary" size="sm">
                  Add to calendar
                </ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {events.map((e) => {
                const meta = EVENT_META[e.type];
                const date = parseISODate(e.start)!;
                return (
                  <li key={e.key}>
                    <Link href={e.href ?? "/admin/calendar"} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6">
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

        <Card title="Recent activity" icon={History} padded={false} className="lg:col-span-2 xl:col-span-1">
          {activities.length === 0 ? (
            <EmptyState compact icon={History} title="No activity yet" description="Admissions, payments, notices and results show here." />
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
      </div>

      {/* Quick actions */}
      <Card title="Quick actions" icon={Zap} className="mt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction href="/admin/students/new" icon={UserPlus} tone="indigo" title="New admission" text="Admit a new student" />
          <QuickAction href="/admin/teachers/new" icon={Presentation} tone="emerald" title="Add teacher" text="Create a teacher profile" />
          <QuickAction href="/admin/staff" icon={Users} tone="sky" title="Add staff" text="Non-teaching staff member" />
          <QuickAction href="/admin/fees/collect" icon={Receipt} tone="amber" title="Collect fee" text="Record a fee payment" />
          <QuickAction href="/admin/notices" icon={Megaphone} tone="teal" title="Send notice" text="WhatsApp or SMS to parents" />
          <QuickAction href="/admin/attendance" icon={CalendarCheck} tone="violet" title="Mark attendance" text="Take today's attendance" />
          <QuickAction href="/admin/id-cards" icon={IdCard} tone="slate" title="Generate ID cards" text="Print student ID cards" />
          <QuickAction href="/admin/exams/new" icon={BarChart3} tone="rose" title="Create exam" text="Set up an exam or test" />
        </div>
      </Card>
    </>
  );
}

type Activity = { key: string; at: Date; icon: LucideIcon; tone: IconTone; title: string; text: string; href: string };

const kpiTones: Record<string, string> = {
  indigo: "from-indigo-500/[0.07] border-indigo-500/15",
  emerald: "from-emerald-500/[0.07] border-emerald-500/15",
  amber: "from-amber-500/[0.08] border-amber-500/20",
  violet: "from-violet-500/[0.07] border-violet-500/15",
  rose: "from-rose-500/[0.07] border-rose-500/15",
  teal: "from-teal-500/[0.07] border-teal-500/15",
};

function KpiCard({
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
  tone: keyof typeof kpiTones & IconTone;
  label: string;
  /** null shows `empty` instead, e.g. "Not marked". */
  value: number | null;
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
      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-display-sm">
        {value == null ? <span className="text-base font-medium text-subtle">{empty}</span> : <AnimatedNumber value={value} prefix={prefix} />}
      </p>
      <p className="mt-1 h-5 text-xs">{badge && <span className="rounded-full bg-surface-3 px-2 py-0.5 font-medium tabular-nums text-fg-2">{badge}</span>}</p>
      <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-accent-text">
        {link}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function QuickAction({ href, icon, tone, title, text }: { href: string; icon: LucideIcon; tone: IconTone; title: string; text: string }) {
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

function AttentionChip({ href, children }: { href: string; children: ReactNode }) {
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

function timeAgo(at: Date, now: Date) {
  const mins = Math.round((now.getTime() - at.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(at);
}
