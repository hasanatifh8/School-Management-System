import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  GraduationCap,
  IdCard,
  IndianRupee,
  Megaphone,
  Presentation,
  Receipt,
  Rocket,
  Sun,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { AttendanceChart, type ClassAttendance } from "@/components/dashboard/attendance-chart";
import { FeeTrendChart } from "@/components/dashboard/fee-trend-chart";
import {
  ActivityCard,
  AttentionChip,
  BirthdaysCard,
  DateChip,
  KpiCard,
  KpiGrid,
  QuickAction,
  RecentResultsCard,
  UpcomingEventsCard,
  longToday,
  upcomingBirthdays,
  type Activity,
} from "@/components/dashboard/widgets";
import { ActiveNoticesCard } from "@/components/dashboard/notices-widget";
import { ButtonLink, Callout, Card, EmptyState, PageHeader, TextLink } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSession, getUpcomingSession, pendingPromotions } from "@/lib/sessions";
import { attendanceWindow } from "@/lib/attendance";
import { attendancePercent, emptyCounts, isSunday, parseISODate } from "@/lib/attendance-shared";
import { loadCalendar } from "@/lib/calendar";
import { monthlyFeeTrend } from "@/lib/fees";
import { rupees } from "@/lib/fees-shared";
import { loadActiveNotices } from "@/lib/messaging/server";

const shortDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

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
    activeNotices,
    publishedResults,
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
    loadActiveNotices(school.id, 5),
    db.examResult.findMany({
      where: { exam: { schoolId: school.id } },
      orderBy: { publishedAt: "desc" },
      take: 5,
      include: { exam: { select: { id: true, name: true, kind: true } }, section: { include: { class: true } } },
    }),
  ]);
  const deliveries = activeNotices.length
    ? await db.noticeRecipient.groupBy({ by: ["noticeId", "status"], where: { noticeId: { in: activeNotices.map((n) => n.id) } }, _count: true })
    : [];
  const deliveryOf = (noticeId: string) => {
    const of = (status: string) => deliveries.find((d) => d.noticeId === noticeId && d.status === status)?._count ?? 0;
    const d = { sent: of("SENT"), failed: of("FAILED"), pending: of("PENDING"), skipped: of("SKIPPED") };
    return { ...d, total: d.sent + d.failed + d.pending + d.skipped };
  };
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
  const birthdays = upcomingBirthdays(
    [
      ...birthdayStudents.map((st) => ({ id: st.id, href: `/admin/students/${st.id}`, name: fullName(st), photoId: st.photoId, sub: st.section ? sectionLabel(st.section) : "Student", dateOfBirth: st.dateOfBirth })),
      ...birthdayTeachers.map((t) => ({ id: t.id, href: `/admin/teachers/${t.id}`, name: fullName(t), photoId: t.photoId, sub: "Teacher", dateOfBirth: t.dateOfBirth })),
    ],
    todayDate,
  );

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
      // Created now, sent on its publish date: say so rather than "sent".
      title: n.publishAt > n.createdAt ? `Notice scheduled for ${shortDay.format(n.publishAt)}` : "Notice sent",
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
  const firstName = viewer?.kind === "admin" ? viewer.admin.name.split(/\s+/)[0] : "Admin";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${firstName}! Here's what's happening at ${school.name} today.`}
        action={
          <>
            <DateChip>
              {longToday(now)}
              <span className="text-subtle">·</span>
              <span className="text-muted">Session {session.name}</span>
            </DateChip>
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
      <KpiGrid>
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
      </KpiGrid>

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

      {/* Notices and results */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ActiveNoticesCard
          notices={activeNotices.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            audience: n.audience,
            channels: n.channels,
            sentBy: n.sentBy,
            createdAt: n.publishAt.toISOString(),
            expiresOn: n.expiresOn ? n.expiresOn.toISOString().slice(0, 10) : null,
            attachment: n.attachment ? { token: n.attachment.token, fileName: n.attachment.fileName } : null,
            delivery: deliveryOf(n.id),
          }))}
        />
        <RecentResultsCard
          results={publishedResults.map((r) => ({
            examId: r.exam.id,
            examName: r.exam.name,
            kind: r.exam.kind,
            sectionId: r.sectionId,
            section: sectionLabel(r.section),
            publishedAt: r.publishedAt,
            publishedBy: r.publishedBy,
          }))}
          empty={
            <EmptyState
              compact
              icon={BarChart3}
              title="No results published yet"
              description="Once marks are in, publish results from an exam's page; they show here."
              action={
                <ButtonLink href="/admin/exams" variant="secondary" size="sm">
                  Open exams
                </ButtonLink>
              }
            />
          }
        />
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <BirthdaysCard birthdays={birthdays} emptyText="Birthdays of students and teachers show here." />
        <UpcomingEventsCard
          events={events}
          calendarHref="/admin/calendar"
          empty={
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
          }
        />
        <ActivityCard activities={activities} emptyText="Admissions, payments, notices and results show here." className="lg:col-span-2 xl:col-span-1" />
      </div>

      {/* Quick actions */}
      <Card title="Quick actions" icon={Zap} className="mt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction href="/admin/students/new" icon={UserPlus} tone="indigo" title="New admission" text="Admit a new student" />
          <QuickAction href="/admin/teachers/new" icon={Presentation} tone="emerald" title="Add teacher" text="Create a teacher profile" />
          <QuickAction href="/admin/staff/new" icon={Users} tone="sky" title="Add staff" text="Non-teaching staff member" />
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
