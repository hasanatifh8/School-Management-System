import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  BookOpenText,
  ChevronRight,
  Crown,
  Sparkles,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  Coffee,
  Megaphone,
  PenLine,
  Plane,
  School,
  Sun,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";
import { AttendanceChart, type ClassAttendance } from "@/components/dashboard/attendance-chart";
import { NoticeBoard } from "@/components/notices/notice-detail";
import { ActivityCard, AttentionChip, BirthdaysCard, UpcomingEventsCard, longToday, upcomingBirthdays, type Activity } from "@/components/dashboard/widgets";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, ButtonLink, Callout, Card, EmptyState, TextLink, cx } from "@/components/ui";
import { Ring, subjectTone } from "@/components/student-portal/ui";
import { photoUrl } from "@/lib/photos";
import { selfCheckIn } from "./actions";
import { attendanceWindow, weeklyOffOn } from "@/lib/attendance";
import { attendancePercent, emptyCounts, isoDate, parseISODate } from "@/lib/attendance-shared";
import { loadCalendar } from "@/lib/calendar";
import { db } from "@/lib/db";
import { leaveBalance, type LeaveBalance } from "@/lib/leave";
import { CATEGORY_SHORT } from "@/lib/leave-shared";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";
import { myProxies } from "@/lib/proxy";
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
  const attendanceDue = win.today === win.max && !(await weeklyOffOn(ctx.school.id, win.today));

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
    myAttendance,
    myLeave,
    studentLeavePending,
    markExams,
    leaveLeft,
  ] = await Promise.all([
    db.student.groupBy({ by: ["sectionId"], where: { sectionId: { in: sectionIds }, status: "ACTIVE" }, _count: true }),
    cls ? db.student.findMany({ where: { sectionId: cls.id, status: "ACTIVE" }, select: { rollNumber: true } }) : [],
    db.student.findMany({
      where: { sectionId: { in: sectionIds }, status: "ACTIVE", dateOfBirth: { not: null } },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        photoId: true,
        sectionId: true,
        section: { include: { class: true } },
      },
    }),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId: ctx.school.id, date: todayDate } } }),
    cls
      ? db.attendanceDay.findUnique({ where: { sectionId_date: { sectionId: cls.id, date: todayDate } }, include: { records: { select: { status: true } } } })
      : null,
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
    cls ? db.student.findMany({ where: { sectionId: cls.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 3 }) : [],
    db.staffAttendance.findMany({
      where: { teacherId: ctx.teacher.id, date: { gte: parseISODate(`${win.today.slice(0, 7)}-01`)!, lte: todayDate } },
      select: { date: true, status: true, markedBy: true },
    }),
    db.leaveRequest.findMany({ where: { teacherId: ctx.teacher.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    cls ? db.leaveRequest.count({ where: { applicant: "STUDENT", status: "PENDING", student: { sectionId: cls.id } } }) : 0,
    db.exam.findMany({
      where: {
        schoolId: ctx.school.id,
        sessionId: session.id,
        papers: { some: { maxMarks: { not: null } } },
        OR: [
          { kind: "TEST", teacherId: ctx.teacher.id },
          { sections: { some: { sectionId: { in: sectionIds } } }, OR: [{ kind: "EXAM", published: true }, { kind: "TEST" }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        kind: true,
        papers: { select: { date: true } },
        sections: { where: { sectionId: { in: sectionIds } }, select: { sectionId: true } },
        results: { where: { sectionId: { in: sectionIds } }, select: { sectionId: true } },
      },
    }),
    leaveBalance(ctx.school.id, "TEACHER", ctx.teacher.id),
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
  const notTaken = !!cls && attendanceDue && !holidayName && !records.length;
  const attendanceEmpty = holidayName ? "Holiday" : !attendanceDue ? "Day off" : "Not taken";

  /* ── Timetable (with any proxy periods the office gave this teacher today) ── */
  const schoolDay = timetable.days.includes(weekday) && !holidayName;
  const proxies = schoolDay ? await myProxies(ctx.teacher.id, win.today) : [];
  const cellFor = (periodId: string) => {
    const proxy = proxies.find((x) => x.period.id === periodId);
    if (proxy) return { title: `Proxy · ${proxy.subject || proxy.section}`, sub: `${proxy.section} · for ${proxy.forTeacher}` };
    return timetable.cells[slotKey(weekday, periodId)];
  };
  const todaysPeriods = schoolDay ? timetable.periods.filter((p) => p.isBreak || cellFor(p.id)) : [];
  const periodsToday = schoolDay ? timetable.periods.filter((p) => !p.isBreak && cellFor(p.id)).length : 0;
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
    ...myNotices.map((n) => ({
      key: `n-${n.id}`,
      at: n.createdAt,
      icon: Megaphone,
      tone: "teal" as const,
      title: "Notice sent",
      text: `${n.title} · ${n.audience}`,
      href: `/teacher/notices/${n.id}`,
    })),
    ...myTests.map((t) => ({
      key: `t-${t.id}`,
      at: t.createdAt,
      icon: ClipboardList,
      tone: "sky" as const,
      title: "Test created",
      text: t.name,
      href: `/teacher/tests/${t.id}`,
    })),
    ...results.map((r) => ({
      key: `x-${r.examId}-${r.sectionId}`,
      at: r.publishedAt,
      icon: BadgeCheck,
      tone: "amber" as const,
      title: "Results published",
      text: `${r.exam.name} · ${sectionLabel(r.section)}`,
      href: `/teacher/tests/${r.exam.id}/results/${r.sectionId}`,
    })),
    ...admissions.map((s) => ({
      key: `s-${s.id}`,
      at: s.createdAt,
      icon: UserPlus,
      tone: "indigo" as const,
      title: "New student in your class",
      text: fullName(s),
      href: `/teacher/students/${s.id}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const noClasses = !cls && ctx.subjectSections.length === 0;

  /* ── Self attendance ── */
  const todayMark = myAttendance.find((a) => isoDate(a.date) === win.today);
  const monthMarks = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0 };
  for (const a of myAttendance) monthMarks[a.status]++;

  const monthCounted = monthMarks.PRESENT + monthMarks.LATE + monthMarks.HALF_DAY + monthMarks.ABSENT;
  const monthPct = monthCounted ? ((monthMarks.PRESENT + monthMarks.LATE + monthMarks.HALF_DAY / 2) / monthCounted) * 100 : null;
  const nextCell = next ? cellFor(next.id) : undefined;
  const pl = leaveLeft.rows.find((r) => r.category === "PRIVILEGED" && r.allowed != null) ?? leaveLeft.rows.find((r) => r.allowed != null);
  const canCheckIn = !todayMark && attendanceDue && !todayHoliday;
  const classCounts = new Map(counts.map((c) => [c.sectionId, c._count]));

  const quick = [
    ...(cls ? [{ href: "/teacher/attendance", label: "Attendance", icon: CalendarCheck, tone: "from-violet-500 to-indigo-600" }] : []),
    { href: "/teacher/tests", label: "Enter marks", icon: PenLine, tone: "from-rose-500 to-pink-600" },
    { href: "/teacher/tests/new", label: "Create test", icon: ClipboardList, tone: "from-sky-500 to-blue-600" },
    { href: "/teacher/materials", label: "Study material", icon: BookOpenText, tone: "from-emerald-500 to-teal-600" },
    ...(cls ? [{ href: "/teacher/notices", label: "Send notice", icon: Megaphone, tone: "from-teal-500 to-cyan-600" }] : []),
    { href: "/teacher/leave/new", label: "Apply leave", icon: Plane, tone: "from-amber-500 to-orange-600" },
  ].slice(0, 6);

  return (
    <>
      {/* Hello */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-sky-600 to-indigo-600 p-6 text-white shadow-lift sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 right-40 h-48 w-48 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-6 h-2 w-2 rounded-full bg-white/50" />
        <span aria-hidden className="pointer-events-none absolute left-[62%] top-16 h-1.5 w-1.5 rounded-full bg-white/40" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Link href="/teacher/profile" className="rounded-full bg-white/20 p-1 ring-2 ring-white/40 transition hover:ring-white/70" aria-label="My profile">
            <Avatar name={fullName(ctx.teacher)} src={photoUrl(ctx.teacher.photoId)} size="xl" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              <Sparkles className="h-4 w-4" aria-hidden /> {greeting()}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{ctx.teacher.firstName}!</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              {ctx.classSections.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 ring-1 ring-white/30">
                  <Crown className="h-3 w-3" /> {sectionLabel(s)}
                </span>
              ))}
              {ctx.teacher.specialization && <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">{ctx.teacher.specialization}</span>}
              <span className="rounded-full bg-white/15 px-3 py-1 font-mono ring-1 ring-white/25">{ctx.teacher.employeeCode}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">Session {session.name}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm ring-1 ring-white/25 backdrop-blur">
            <p className="text-xs text-white/75">{longToday()}</p>
            <p className="font-semibold">
              {holidayName
                ? `Holiday · ${holidayName}`
                : todayMark
                  ? `You're marked ${SELF_STATUS[todayMark.status].label.toLowerCase()}`
                  : attendanceDue
                    ? "You're not marked yet"
                    : "No school today"}
            </p>
            {canCheckIn && (
              <ActionForm action={selfCheckIn} compact className="mt-2 flex flex-row-reverse items-center justify-end gap-2">
                <SubmitButton size="sm" variant="secondary" icon={<UserRoundCheck className="h-4 w-4" />}>
                  Check in
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>
        <p className="relative mt-5 max-w-2xl text-sm text-white/90">
          {noClasses
            ? "Your classes will appear here once the school assigns them."
            : !schoolDay
              ? "No classes today. A good day to plan ahead."
              : next && nextCell
                ? `${periodsToday} period${periodsToday === 1 ? "" : "s"} today. Next up at ${formatTime(next.startTime)}: ${nextCell.title}${nextCell.sub ? ` with ${nextCell.sub}` : ""}.`
                : periodsToday
                  ? "That's all your periods for today. Well done!"
                  : "No periods for you today."}
          {notTaken && " Don't forget today's attendance."}
        </p>
      </section>

      <div className="mb-6 empty:hidden">
        <NoticeBoard schoolId={ctx.school.id} audience="teachers" title="Notices" />
      </div>

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
          {(notTaken || missingRolls > 0 || studentLeavePending > 0) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {notTaken && <AttentionChip href="/teacher/attendance">Attendance for {sectionLabel(cls!)} isn&apos;t taken yet today</AttentionChip>}
              {studentLeavePending > 0 && (
                <AttentionChip href="/teacher/leave?who=student">
                  {studentLeavePending} student leave request{studentLeavePending === 1 ? "" : "s"} to decide
                </AttentionChip>
              )}
              {missingRolls > 0 && <AttentionChip href="/teacher/class">{missingRolls} student(s) have no roll number</AttentionChip>}
            </div>
          )}

          {/* At a glance */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cls ? (
              <Link
                href="/teacher/attendance"
                className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <Ring value={presentPct} sub="present" label={records.length ? undefined : "—"} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{sectionLabel(cls)} today</p>
                  <p className="text-xs text-muted">
                    {records.length
                      ? `${present} present · ${today.ABSENT} absent of ${records.length}`
                      : `${attendanceEmpty} · ${classStudents.length} students`}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text">
                    {records.length ? "Edit attendance" : "Take attendance"} <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            ) : (
              <Link
                href="/teacher/students"
                className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/10 dark:text-emerald-300">
                  <span className="text-2xl font-bold tabular-nums">{totalStudents}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider">students</span>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">Students I teach</p>
                  <p className="text-xs text-muted">
                    {ctx.subjectSections.length} class{ctx.subjectSections.length === 1 ? "" : "es"} · {subjectCount} subject{subjectCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text">
                    View students <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            )}
            <Link
              href="/teacher/my-attendance"
              className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <Ring value={monthPct} sub="this month" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">My attendance</p>
                <p className="text-xs text-muted">
                  {monthCounted ? `${monthMarks.PRESENT + monthMarks.LATE} present · ${monthMarks.ABSENT} absent` : "Nothing marked this month"}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text">
                  Full session <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
            <Link
              href="/teacher/timetable"
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 p-5 text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <CalendarClock className="absolute -right-3 -top-3 h-20 w-20 text-white/10" aria-hidden />
              <p className="text-sm font-semibold text-white/85">Next period</p>
              {next && nextCell ? (
                <>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{formatTime(next.startTime)}</p>
                  <p className="mt-1 truncate text-sm font-medium">{nextCell.title}</p>
                  <p className="truncate text-xs text-white/75">{[nextCell.sub, next.name].filter(Boolean).join(" · ")}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{schoolDay ? periodsToday : "—"}</p>
                  <p className="mt-1 text-sm text-white/85">
                    {schoolDay ? (periodsToday ? "periods today, all done" : "No periods today") : "No school today"}
                  </p>
                </>
              )}
            </Link>
            <Link
              href="/teacher/leave"
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-rose-500 p-5 text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <Plane className="absolute -right-3 -top-3 h-20 w-20 text-white/15" aria-hidden />
              {pl ? (
                <>
                  <p className="text-sm font-semibold text-white/85">{CATEGORY_SHORT[pl.category]} left</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {Math.max(0, pl.allowed! - pl.used)}
                    <span className="text-base font-medium text-white/75"> / {pl.allowed}</span>
                  </p>
                  <p className="mt-1 truncate text-sm">Session {leaveLeft.session}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white/85">Upcoming tests</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{upcomingExams.length}</p>
                  <p className="mt-1 truncate text-sm">Exams and tests ahead</p>
                </>
              )}
            </Link>
          </div>

          {/* Today */}
          <div className="mb-6 grid items-start gap-6 xl:grid-cols-3">
            <Card
              title="Today's schedule"
              icon={CalendarClock}
              className="xl:col-span-2"
              description={schoolDay ? `${periodsToday} period(s) to teach${proxies.length ? ` · ${proxies.length} proxy` : ""}` : "No classes today"}
              action={<TextLink href="/teacher/timetable">Full week</TextLink>}
            >
              {todaysPeriods.length === 0 ? (
                <EmptyState
                  compact
                  icon={holidayName ? CalendarOff : Sun}
                  title={holidayName ? `Holiday: ${holidayName}` : schoolDay ? "No periods for you today" : "No school today"}
                  description={timetable.periods.length ? "Your periods from the class timetables show here." : "The school hasn't set up its timetable yet."}
                />
              ) : (
                <ol className="relative space-y-2 border-l-2 border-dashed border-line pl-5">
                  {todaysPeriods.map((p) => (
                    <ScheduleRow key={p.id} period={p} cell={cellFor(p.id)} now={now} next={next?.id === p.id} />
                  ))}
                </ol>
              )}
            </Card>

            <section className="grid grid-cols-2 gap-3" aria-label="Quick actions">
              {quick.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className={cx(
                    "group flex aspect-[4/3] flex-col justify-between rounded-3xl bg-gradient-to-br p-4 text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift",
                    q.tone,
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
                    <q.icon className="h-5 w-5" />
                  </span>
                  <span className="flex items-center justify-between text-sm font-semibold">
                    {q.label}
                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </section>
          </div>

          {/* Class and leave */}
          <div className="mb-6 grid items-start gap-6 xl:grid-cols-3">
            {cls ? (
              <Card
                title={`Attendance · ${sectionLabel(cls)}`}
                icon={CalendarCheck}
                className="xl:col-span-2"
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
              <ClassesCard ctx={ctx} counts={classCounts} className="xl:col-span-2" />
            )}
            <LeaveCard requests={myLeave} balance={leaveLeft} />
          </div>

          {/* Classes, marks, my month */}
          <div className="mb-6 grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <ClassesSubjectsCard ctx={ctx} counts={classCounts} />
            <MarksCard exams={markExams} today={win.today} />
            <SelfAttendanceCard today={todayMark ? { status: todayMark.status, by: todayMark.markedBy } : null} month={monthMarks} />
          </div>

          {/* Lists */}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <BirthdaysCard birthdays={birthdays} emptyText="Birthdays of the students you teach show here." />
            <UpcomingEventsCard
              events={events}
              calendarHref="/teacher/calendar"
              empty={<EmptyState compact icon={CalendarDays} title="Nothing scheduled" description="Exams, events and holidays the school plans show here." />}
            />
            <ActivityCard activities={activities} emptyText="Your notices, tests and results show here." className="lg:col-span-2 xl:col-span-1" />
          </div>
        </>
      )}
    </>
  );
}

/** One period of today on the timeline, coloured by subject, with Now / Next markers. */
function ScheduleRow({ period, cell, now, next }: { period: PeriodInfo; cell?: { title: string; sub?: string }; now: string; next: boolean }) {
  const live = period.startTime <= now && now < period.endTime;
  const done = period.endTime <= now;
  const tone = subjectTone(cell?.title.replace(/^Proxy · /, ""));
  return (
    <li className="relative">
      <span
        aria-hidden
        className={cx(
          "absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-surface",
          live ? "bg-accent animate-pulse" : done ? "bg-line-strong" : period.isBreak ? "bg-amber-400" : tone.bar,
        )}
      />
      {period.isBreak ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {period.isAssembly ? <Megaphone className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />} {period.name} · {formatTime(period.startTime)}
        </div>
      ) : (
        <div
          className={cx(
            "flex items-center gap-3 rounded-xl bg-gradient-to-r to-transparent px-3 py-2.5 ring-1",
            tone.soft,
            tone.ring,
            live && "ring-2 ring-accent",
            done && "opacity-60",
          )}
        >
          <span className="w-16 shrink-0 text-xs tabular-nums text-muted">
            <span className="block font-medium text-fg-2">{formatTime(period.startTime)}</span>
            {formatTime(period.endTime)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-fg">{cell?.title}</span>
            <span className="block truncate text-xs text-muted">{[cell?.sub, period.name].filter(Boolean).join(" · ")}</span>
          </span>
          {live && (
            <Badge tone="indigo" dot>
              Now
            </Badge>
          )}
          {next && !live && <Badge tone="sky">Next</Badge>}
        </div>
      )}
    </li>
  );
}

/** For subject teachers without a class of their own: the sections they teach. */
function ClassesCard({ ctx, counts, className }: { ctx: Awaited<ReturnType<typeof requireTeacher>>; counts: Map<string | null, number>; className?: string }) {
  return (
    <Card title="Classes I teach" icon={BookOpen} description="Where you are the subject teacher." className={className}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ctx.subjectSections.map((s) => {
          const tone = subjectTone(s.subjects[0]);
          return (
            <li key={s.section.id}>
              <Link
                href={`/teacher/sections/${s.section.id}`}
                className={cx(
                  "flex h-full flex-col rounded-2xl bg-gradient-to-br to-transparent p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-card",
                  tone.soft,
                  tone.ring,
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-fg">{sectionLabel(s.section)}</span>
                  <Badge>{counts.get(s.section.id) ?? 0} students</Badge>
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {s.subjects.map((subject) => (
                    <span key={subject} className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", subjectTone(subject).chip)}>
                      {subject}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const SELF_STATUS = {
  PRESENT: { label: "Present", tone: "green" },
  ABSENT: { label: "Absent", tone: "red" },
  LATE: { label: "Late", tone: "amber" },
  HALF_DAY: { label: "Half day", tone: "sky" },
  ON_LEAVE: { label: "On leave", tone: "slate" },
} as const;

const SELF_TILE = {
  PRESENT: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  ABSENT: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  LATE: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  HALF_DAY: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  ON_LEAVE: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
} as const;

/** The teacher's own attendance: today and this month, one coloured tile per status. */
function SelfAttendanceCard({
  today,
  month,
}: {
  today: { status: keyof typeof SELF_STATUS; by: string | null } | null;
  month: Record<keyof typeof SELF_STATUS, number>;
}) {
  return (
    <Card
      title="My month"
      icon={UserRoundCheck}
      description="Marked by the office, or your own check-in"
      action={<TextLink href="/teacher/my-attendance">Full session</TextLink>}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">Today</span>
        {today ? (
          <span title={today.by ? `Marked by ${today.by}` : undefined}>
            <Badge tone={SELF_STATUS[today.status].tone} dot>
              {SELF_STATUS[today.status].label}
            </Badge>
          </span>
        ) : (
          <Badge tone="amber" dot>
            Not marked
          </Badge>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
        {(Object.keys(SELF_STATUS) as (keyof typeof SELF_STATUS)[]).map((k) => (
          <div key={k} className={cx("rounded-2xl px-1 py-2.5", SELF_TILE[k])}>
            <dd className="text-xl font-bold tabular-nums">{month[k]}</dd>
            <dt className="text-[11px] font-medium">{SELF_STATUS[k].label}</dt>
          </div>
        ))}
      </dl>
    </Card>
  );
}

const LEAVE_TONE = { PENDING: "amber", APPROVED: "green", REJECTED: "red" } as const;
const shortDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** The teacher's latest leave requests, and students' requests waiting on them. */
function LeaveCard({
  requests,
  balance,
}: {
  requests: { id: string; fromDate: Date; toDate: Date; status: keyof typeof LEAVE_TONE }[];
  balance: LeaveBalance;
}) {
  // Leave left this session for each type with a limit, PL first.
  const limited = balance.rows.filter((r) => r.allowed != null);
  return (
    <Card title="My leave" icon={Plane} action={<TextLink href="/teacher/leave/new">Apply</TextLink>}>
      {limited.length > 0 && (
        <Link href="/teacher/my-attendance" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Leave balance">
          {limited.map((r) => {
            const left = Math.max(0, r.allowed! - r.used);
            return (
              <span
                key={r.category}
                className={cx(
                  "rounded-2xl px-3 py-2",
                  left ? "bg-gradient-to-br from-violet-50 to-sky-50 dark:from-violet-500/10 dark:to-sky-500/10" : "bg-danger-soft",
                )}
              >
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{CATEGORY_SHORT[r.category]} left</span>
                <span className={`text-xl font-bold tabular-nums ${left ? "text-fg" : "text-danger"}`}>
                  {left}
                  <span className="text-xs font-normal text-subtle"> / {r.allowed}</span>
                </span>
              </span>
            );
          })}
        </Link>
      )}
      {requests.length === 0 ? (
        <p className="text-sm text-muted">No leave requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-fg-2">
                {shortDay.format(r.fromDate)}
                {r.toDate.getTime() !== r.fromDate.getTime() && ` – ${shortDay.format(r.toDate)}`}
              </span>
              <Badge tone={LEAVE_TONE[r.status]} dot>
                {r.status === "PENDING" ? "Pending" : r.status === "APPROVED" ? "Approved" : "Rejected"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <TextLink href="/teacher/leave?who=mine" className="mt-3 inline-block">
        All my leave
      </TextLink>
    </Card>
  );
}

/** The teacher's class and the subjects they teach in each section. */
function ClassesSubjectsCard({ ctx, counts }: { ctx: Awaited<ReturnType<typeof requireTeacher>>; counts: Map<string | null, number> }) {
  const rows = [
    ...ctx.classSections.map((s) => ({
      id: s.id,
      label: sectionLabel(s),
      text: "Class teacher",
      href: `/teacher/switch-class?id=${s.id}&to=/teacher/class`,
      switches: true,
    })),
    ...ctx.subjectSections
      .filter((s) => !ctx.isClassTeacherOf(s.section.id))
      .map((s) => ({
        id: s.section.id,
        label: sectionLabel(s.section),
        text: s.subjects.join(", "),
        href: `/teacher/sections/${s.section.id}`,
        switches: false,
      })),
  ];
  return (
    <Card title="Classes & subjects" icon={BookOpen} padded={false}>
      {rows.length === 0 ? (
        <p className="px-6 py-5 text-sm text-muted">No classes assigned yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r, i) => {
            const body = (
              <>
                <span className={cx("h-8 w-1.5 shrink-0 rounded-full", r.switches ? "bg-indigo-500" : subjectTone(r.text.split(", ")[0]).bar)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{r.label}</span>
                  <span className="block truncate text-xs text-muted">{r.text}</span>
                </span>
                <Badge>{counts.get(r.id) ?? 0}</Badge>
              </>
            );
            const row = "flex items-center gap-3 px-5 py-2.5 transition hover:bg-surface-2";
            return (
              <li key={`${r.id}-${i}`}>
                {/* Switching class is a plain link (full page load) so the sidebar follows; see ClassSwitcher. */}
                {r.switches ? (
                  <a href={r.href} className={row}>
                    {body}
                  </a>
                ) : (
                  <Link href={r.href} className={row}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Recent exams and tests of the teacher's classes: enter or review marks. */
function MarksCard({
  exams,
  today,
}: {
  exams: { id: string; name: string; kind: "EXAM" | "TEST"; papers: { date: Date }[]; sections: { sectionId: string }[]; results: { sectionId: string }[] }[];
  today: string;
}) {
  return (
    <Card title="Exams & marks" icon={PenLine} action={<TextLink href="/teacher/tests">All</TextLink>} padded={false}>
      {exams.length === 0 ? (
        <p className="px-6 py-5 text-sm text-muted">No graded exams or tests yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {exams.map((e) => {
            const started = e.papers.some((p) => isoDate(p.date) <= today);
            const done = e.results.length;
            return (
              <li key={e.id}>
                <Link href={`/teacher/tests/${e.id}`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{e.name}</span>
                    <span className="block text-xs text-muted">
                      {e.kind === "EXAM" ? "Exam" : "Test"} · results {done}/{e.sections.length}
                    </span>
                  </span>
                  <Badge tone={done === e.sections.length && done > 0 ? "green" : started ? "amber" : "slate"}>
                    {done === e.sections.length && done > 0 ? "Published" : started ? "Enter marks" : "Upcoming"}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
