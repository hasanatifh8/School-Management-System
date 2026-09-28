import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  Coffee,
  GraduationCap,
  IdCard,
  Megaphone,
  PenLine,
  School,
  Sun,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Users,
  Zap,
} from "lucide-react";
import { AttendanceChart, type ClassAttendance } from "@/components/dashboard/attendance-chart";
import {
  ActivityCard,
  AttentionChip,
  BirthdaysCard,
  DateChip,
  KpiCard,
  KpiGrid,
  QuickAction,
  UpcomingEventsCard,
  longToday,
  upcomingBirthdays,
  type Activity,
} from "@/components/dashboard/widgets";
import { Badge, ButtonLink, Callout, Card, EmptyState, IconTile, PageHeader, TextLink } from "@/components/ui";
import { attendanceWindow } from "@/lib/attendance";
import { attendancePercent, emptyCounts, isSunday, isoDate, parseISODate } from "@/lib/attendance-shared";
import { loadCalendar } from "@/lib/calendar";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";
import { loadTeacherTimetable } from "@/lib/timetable";
import { formatTime, slotKey, type PeriodInfo } from "@/lib/timetable-shared";

const weekdayShort = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** The teacher's home: today's classes and attendance, their students, and what's coming up. */
export default async function TeacherDashboard() {
  const ctx = await requireTeacher();
  const cls = ctx.classSection;
  const sectionIds = [...ctx.visibleSectionIds];
  const win = await attendanceWindow(ctx.school.id);
  const todayDate = parseISODate(win.today)!;
  const weekday = todayDate.getUTCDay() || 7;
  const session = await getCurrentSession(ctx.school.id);
  const attendanceDue = win.today === win.max && !isSunday(win.today);

  const [
    counts,
    classStudents,
    students,
    todayHoliday,
    todayDay,
    recentDays,
    timetable,
    upcomingExams,
    calendar,
    myNotices,
    myTests,
    results,
    admissions,
  ] = await Promise.all([
    db.student.groupBy({ by: ["sectionId"], where: { sectionId: { in: sectionIds }, status: "ACTIVE" }, _count: true }),
    cls ? db.student.findMany({ where: { sectionId: cls.id, status: "ACTIVE" }, select: { rollNumber: true } }) : [],
    db.student.findMany({
      where: { sectionId: { in: sectionIds }, status: "ACTIVE", dateOfBirth: { not: null } },
      select: { id: true, firstName: true, middleName: true, lastName: true, dateOfBirth: true, photoId: true, sectionId: true, section: { include: { class: true } } },
    }),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId: ctx.school.id, date: todayDate } } }),
    cls ? db.attendanceDay.findUnique({ where: { sectionId_date: { sectionId: cls.id, date: todayDate } }, include: { records: { select: { status: true } } } }) : null,
    cls
      ? db.attendanceDay.findMany({
          where: { sectionId: cls.id, holiday: null, date: { lte: todayDate }, records: { some: {} } },
          orderBy: { date: "desc" },
          take: 10,
          include: { records: { select: { status: true } } },
        })
      : [],
    loadTeacherTimetable(ctx.school.id, ctx.teacher.id),
    db.exam.findMany({
      where: {
        schoolId: ctx.school.id,
        sessionId: session.id,
        papers: { some: { date: { gte: todayDate } } },
        OR: [
          { kind: "TEST", teacherId: ctx.teacher.id },
          { sections: { some: { sectionId: { in: sectionIds } } }, OR: [{ kind: "EXAM", published: true }, { kind: "TEST" }] },
        ],
      },
      select: { id: true },
    }),
    loadCalendar(ctx.school.id, session, { forTeacher: true }),
    db.notice.findMany({ where: { schoolId: ctx.school.id, teacherId: ctx.teacher.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.exam.findMany({ where: { schoolId: ctx.school.id, kind: "TEST", teacherId: ctx.teacher.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.examResult.findMany({
      where: { sectionId: { in: sectionIds }, exam: { schoolId: ctx.school.id } },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: { exam: { select: { id: true, name: true } }, section: { include: { class: true } } },
    }),
    cls
      ? db.student.findMany({ where: { sectionId: cls.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 3 })
      : [],
  ]);

  /* ── Numbers ── */
  const totalStudents = counts.reduce((n, c) => n + c._count, 0);
  const subjectCount = new Set(ctx.subjectSections.flatMap((s) => s.subjects)).size;
  const missingRolls = classStudents.filter((s) => s.rollNumber == null).length;
  const holidayName = todayHoliday?.name ?? todayDay?.holiday ?? null;
  const records = todayDay && !todayDay.holiday ? todayDay.records : [];
  const today = emptyCounts();
  for (const r of records) today[r.status]++;
  const presentPct = attendancePercent(today);
  const present = today.PRESENT + today.LATE + today.HALF_DAY;
  const absentPct = records.length ? Math.round((today.ABSENT / records.length) * 1000) / 10 : null;
  const notTaken = !!cls && attendanceDue && !holidayName && !records.length;
  const attendanceEmpty = holidayName ? "Holiday" : !attendanceDue ? "Day off" : "Not taken";

  /* ── Timetable ── */
  const schoolDay = timetable.days.includes(weekday) && !holidayName;
  const todaysPeriods = schoolDay ? timetable.periods.filter((p) => p.isBreak || timetable.cells[slotKey(weekday, p.id)]) : [];
  const periodsToday = schoolDay ? timetable.periods.filter((p) => !p.isBreak && timetable.cells[slotKey(weekday, p.id)]).length : 0;
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date());
  const next = todaysPeriods.find((p) => !p.isBreak && p.startTime > now);

  /* ── Attendance trend (own class) ── */
  const trend: ClassAttendance[] = [...recentDays].reverse().map((d) => {
    const c = emptyCounts();
    for (const r of d.records) c[r.status]++;
    return { id: isoDate(d.date), name: weekdayShort.format(d.date), present: c.PRESENT + c.LATE + c.HALF_DAY, absent: c.ABSENT, leave: c.LEAVE };
  });

  /* ── Lists ── */
  const birthdays = upcomingBirthdays(
    students.map((s) => ({
      id: s.id,
      href: s.sectionId === cls?.id ? `/teacher/students/${s.id}` : `/teacher/sections/${s.sectionId}`,
      name: fullName(s),
      photoId: s.photoId,
      sub: s.section ? sectionLabel(s.section) : "",
      dateOfBirth: s.dateOfBirth,
    })),
    todayDate,
  );
  const events = calendar.items.filter((i) => i.end >= win.today).slice(0, 5);
  const activities: Activity[] = [
    ...myNotices.map((n) => ({ key: `n-${n.id}`, at: n.createdAt, icon: Megaphone, tone: "teal" as const, title: "Notice sent", text: `${n.title} · ${n.audience}`, href: `/teacher/notices/${n.id}` })),
    ...myTests.map((t) => ({ key: `t-${t.id}`, at: t.createdAt, icon: ClipboardList, tone: "sky" as const, title: "Test created", text: t.name, href: `/teacher/tests/${t.id}` })),
    ...results.map((r) => ({
      key: `x-${r.examId}-${r.sectionId}`,
      at: r.publishedAt,
      icon: BadgeCheck,
      tone: "amber" as const,
      title: "Results published",
      text: `${r.exam.name} · ${sectionLabel(r.section)}`,
      href: `/teacher/tests/${r.exam.id}/results/${r.sectionId}`,
    })),
    ...admissions.map((s) => ({ key: `s-${s.id}`, at: s.createdAt, icon: UserPlus, tone: "indigo" as const, title: "New student in your class", text: fullName(s), href: `/teacher/students/${s.id}` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const noClasses = !cls && ctx.subjectSections.length === 0;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${ctx.teacher.firstName}`}
        subtitle={`Here's your day at ${ctx.school.name}${ctx.teacher.specialization ? ` · ${ctx.teacher.specialization}` : ""}.`}
        action={
          <>
            <DateChip>{longToday()}</DateChip>
            {cls ? (
              <ButtonLink href="/teacher/attendance" icon={CalendarCheck}>
                Take attendance
              </ButtonLink>
            ) : (
              ctx.visibleSectionIds.size > 0 && (
                <ButtonLink href="/teacher/tests/new" icon={ClipboardList}>
                  Create test
                </ButtonLink>
              )
            )}
          </>
        }
      />

      {noClasses ? (
        <Card>
          <EmptyState
            icon={School}
            title="No classes assigned yet"
            description="Ask your school admin to make you a class teacher or a subject teacher. Your classes will appear here."
          />
        </Card>
      ) : (
        <>
          {holidayName && (
            <Callout icon={CalendarOff} tone="info" className="mb-4">
              <strong className="font-semibold">Today is a holiday:</strong> {holidayName}. No attendance is due.
            </Callout>
          )}
          {(notTaken || missingRolls > 0) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {notTaken && <AttentionChip href="/teacher/attendance">Attendance for {sectionLabel(cls!)} isn&apos;t taken yet today</AttentionChip>}
              {missingRolls > 0 && <AttentionChip href="/teacher/class">{missingRolls} student(s) have no roll number</AttentionChip>}
            </div>
          )}

          {/* Key numbers */}
          <KpiGrid>
            {cls ? (
              <KpiCard href="/teacher/class" icon={Users} tone="indigo" label="My class" value={sectionLabel(cls)} badge={`${classStudents.length} students`} link="Open class" />
            ) : (
              <KpiCard href="/teacher/timetable" icon={School} tone="indigo" label="Classes I teach" value={ctx.subjectSections.length} link="My timetable" />
            )}
            <KpiCard
              href={cls ? "/teacher/class" : "/teacher/timetable"}
              icon={GraduationCap}
              tone="emerald"
              label="Students I teach"
              value={totalStudents}
              badge={`${subjectCount} subject${subjectCount === 1 ? "" : "s"}`}
              link="View students"
            />
            <KpiCard
              href="/teacher/timetable"
              icon={CalendarClock}
              tone="amber"
              label="Periods today"
              value={schoolDay ? periodsToday : null}
              empty={holidayName ? "Holiday" : "No school"}
              badge={next ? `Next ${formatTime(next.startTime)}` : undefined}
              link="My timetable"
            />
            {cls ? (
              <>
                <KpiCard
                  href="/teacher/attendance"
                  icon={UserRoundCheck}
                  tone="violet"
                  label="Present today"
                  value={records.length ? present : null}
                  badge={presentPct != null ? `${presentPct}%` : undefined}
                  empty={attendanceEmpty}
                  link={records.length ? "Edit attendance" : "Take attendance"}
                />
                <KpiCard
                  href={today.ABSENT ? `/teacher/notices?absent=${win.today}` : "/teacher/attendance/register"}
                  icon={UserRoundX}
                  tone="rose"
                  label="Absent today"
                  value={records.length ? today.ABSENT : null}
                  badge={absentPct != null ? `${absentPct}%` : undefined}
                  empty={attendanceEmpty}
                  link={today.ABSENT ? "Message parents" : "View register"}
                />
              </>
            ) : (
              <>
                <KpiCard href="/teacher/tests" icon={BookOpen} tone="violet" label="Subjects I teach" value={subjectCount} link="Tests & marks" />
                <KpiCard href="/teacher/timetable" icon={CalendarDays} tone="rose" label="Periods a week" value={timetable.count} link="My timetable" />
              </>
            )}
            <KpiCard href="/teacher/tests" icon={ClipboardList} tone="teal" label="Upcoming tests" value={upcomingExams.length} badge="exams & tests" link="Tests & exams" />
          </KpiGrid>

          {/* Today */}
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {cls ? (
              <Card
                title={`Attendance · ${sectionLabel(cls)}`}
                icon={CalendarCheck}
                description="Present and absent, last school days"
                action={<TextLink href="/teacher/attendance/register">View register</TextLink>}
              >
                {trend.length ? (
                  <AttendanceChart data={trend} href="/teacher/attendance/register" />
                ) : (
                  <EmptyState
                    compact
                    icon={CalendarCheck}
                    title="No attendance yet"
                    description="Days you mark show here."
                    action={
                      <ButtonLink href="/teacher/attendance" variant="secondary" size="sm">
                        Take attendance
                      </ButtonLink>
                    }
                  />
                )}
              </Card>
            ) : (
              <ClassesCard ctx={ctx} counts={new Map(counts.map((c) => [c.sectionId, c._count]))} />
            )}

            <Card
              title="Today's schedule"
              icon={CalendarClock}
              description={schoolDay ? `${periodsToday} period(s) to teach` : "No classes today"}
              action={<TextLink href="/teacher/timetable">Full week</TextLink>}
              padded={false}
            >
              {todaysPeriods.length === 0 ? (
                <EmptyState
                  compact
                  icon={holidayName ? CalendarOff : Sun}
                  title={holidayName ? `Holiday: ${holidayName}` : schoolDay ? "No periods for you today" : "No school today"}
                  description={
                    timetable.periods.length ? "Your periods from the class timetables show here." : "The school hasn't set up its timetable yet."
                  }
                />
              ) : (
                <ol className="divide-y divide-line">
                  {todaysPeriods.map((p) => (
                    <ScheduleRow key={p.id} period={p} cell={timetable.cells[slotKey(weekday, p.id)]} now={now} next={next?.id === p.id} />
                  ))}
                </ol>
              )}
            </Card>
          </div>

          {/* Lists */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <BirthdaysCard birthdays={birthdays} emptyText="Birthdays of the students you teach show here." />
            <UpcomingEventsCard
              events={events}
              calendarHref="/teacher/calendar"
              empty={<EmptyState compact icon={CalendarDays} title="Nothing scheduled" description="Exams, events and holidays the school plans show here." />}
            />
            <ActivityCard activities={activities} emptyText="Your notices, tests and results show here." className="lg:col-span-2 xl:col-span-1" />
          </div>

          {/* Quick actions */}
          <Card title="Quick actions" icon={Zap} className="mt-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cls && <QuickAction href="/teacher/attendance" icon={CalendarCheck} tone="violet" title="Take attendance" text={`Mark ${sectionLabel(cls)} for today`} />}
              {cls && <QuickAction href="/teacher/notices" icon={Megaphone} tone="teal" title="Send notice" text="WhatsApp or SMS to parents" />}
              <QuickAction href="/teacher/tests/new" icon={ClipboardList} tone="sky" title="Create test" text="Schedule a class test" />
              <QuickAction href="/teacher/tests" icon={PenLine} tone="rose" title="Enter marks" text="Marks for tests and exams" />
              <QuickAction href="/teacher/timetable" icon={CalendarClock} tone="amber" title="My timetable" text="Your periods this week" />
              <QuickAction href="/teacher/calendar" icon={CalendarDays} tone="emerald" title="School calendar" text="Exams, events and holidays" />
              {cls && <QuickAction href="/teacher/class" icon={Users} tone="indigo" title="My class" text="Students, roll numbers and details" />}
              {cls && <QuickAction href="/teacher/id-cards" icon={IdCard} tone="slate" title="ID cards" text="Print your class's ID cards" />}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

/** One period of today: what the teacher has, with Now / Next markers. */
function ScheduleRow({ period, cell, now, next }: { period: PeriodInfo; cell?: { title: string; sub?: string }; now: string; next: boolean }) {
  const current = period.startTime <= now && now < period.endTime;
  const past = period.endTime <= now;
  return (
    <li className={`flex items-center gap-3 px-4 py-3 sm:px-6 ${current ? "bg-accent-soft/60" : ""} ${past ? "opacity-60" : ""}`}>
      <span className="w-20 shrink-0 text-xs tabular-nums text-muted">
        <span className="block font-medium text-fg-2">{formatTime(period.startTime)}</span>
        {formatTime(period.endTime)}
      </span>
      {period.isBreak ? (
        <span className="flex flex-1 items-center gap-2 text-sm text-muted">
          <Coffee className="h-4 w-4" aria-hidden /> {period.name}
        </span>
      ) : (
        <>
          <IconTile icon={BookOpen} tone={current ? "indigo" : "slate"} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{cell?.title}</span>
            <span className="block truncate text-xs text-muted">
              {cell?.sub} · {period.name}
            </span>
          </span>
          {current && <Badge tone="indigo">Now</Badge>}
          {next && !current && <Badge tone="sky">Next</Badge>}
        </>
      )}
    </li>
  );
}

/** For subject teachers without a class of their own: the sections they teach. */
function ClassesCard({ ctx, counts }: { ctx: Awaited<ReturnType<typeof requireTeacher>>; counts: Map<string | null, number> }) {
  return (
    <Card title="Classes I teach" icon={BookOpen} description="Where you are the subject teacher." padded={false}>
      <ul className="divide-y divide-line">
        {ctx.subjectSections.map((s) => (
          <li key={s.section.id}>
            <Link href={`/teacher/sections/${s.section.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6">
              <IconTile icon={BookOpen} tone="emerald" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-fg">{sectionLabel(s.section)}</span>
                <span className="block truncate text-xs text-muted">{s.subjects.join(", ")}</span>
              </span>
              <Badge>{counts.get(s.section.id) ?? 0} students</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
