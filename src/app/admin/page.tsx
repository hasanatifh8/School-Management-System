import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarOff,
  CircleCheck,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  IndianRupee,
  Megaphone,
  Presentation,
  Rocket,
  School,
  Shield,
  Sun,
  TriangleAlert,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  AnimatedNumber,
  Badge,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  HeroCard,
  HeroGhostLink,
  HeroLink,
  HeroProgress,
  MenuLink,
  MoreMenu,
  PageHeader,
  PersonCell,
  ProgressBar,
  StatCard,
  StatGrid,
  TextLink,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { houseColor } from "@/lib/houses";
import { getCurrentSession, getUpcomingSession, pendingPromotions } from "@/lib/sessions";
import { attendanceWindow } from "@/lib/attendance";
import { attendancePercent, emptyCounts, isSunday, parseISODate } from "@/lib/attendance-shared";

export default async function DashboardPage() {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  const active = { schoolId: school.id, status: "ACTIVE" as const };
  const [session, upcoming] = await Promise.all([getCurrentSession(school.id), getUpcomingSession(school.id)]);
  const pending = upcoming ? await pendingPromotions(school.id, session.id) : [];

  const win = await attendanceWindow(school.id);
  const todayDate = parseISODate(win.today)!;

  const [
    studentCount,
    genderCounts,
    teacherCount,
    classTeacherCount,
    classes,
    subjectCount,
    unassignedStudents,
    sectionsWithoutTeacher,
    recentStudents,
    houses,
    feesToday,
  ] = await Promise.all([
    db.student.count({ where: active }),
    db.student.groupBy({ by: ["gender"], where: active, _count: true }),
    db.teacher.count({ where: active }),
    db.section.count({ where: { class: { schoolId: school.id }, classTeacherId: { not: null } } }),
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        sections: {
          orderBy: { name: "asc" },
          include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
        },
      },
    }),
    db.subject.count({ where: { schoolId: school.id } }),
    db.student.count({ where: { ...active, sectionId: null } }),
    db.section.findMany({
      where: { class: { schoolId: school.id }, classTeacherId: null },
      include: { class: true },
      orderBy: [{ class: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    db.student.findMany({
      where: active,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { section: { include: { class: true } } },
    }),
    db.house.findMany({
      where: { schoolId: school.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
    }),
    db.feeReceipt.aggregate({
      where: { schoolId: school.id, cancelledAt: null, date: todayDate },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  // Today's attendance (skipped on Sundays and school holidays).
  const attendanceDue = win.today === win.max && !isSunday(win.today);
  const [todayHoliday, todayDays, todayStatus] = attendanceDue
    ? await Promise.all([
        db.holiday.findUnique({ where: { schoolId_date: { schoolId: school.id, date: todayDate } } }),
        db.attendanceDay.findMany({ where: { schoolId: school.id, date: todayDate }, select: { sectionId: true } }),
        db.attendanceRecord.groupBy({
          by: ["status"],
          where: { day: { schoolId: school.id, date: todayDate, holiday: null } },
          _count: true,
        }),
      ])
    : [null, [], []];
  const takenToday = new Set(todayDays.map((d) => d.sectionId));
  const sectionsWithStudents = classes.flatMap((c) => c.sections.map((s) => ({ ...s, class: c }))).filter((s) => s._count.students > 0);
  const toMark = attendanceDue && !todayHoliday ? sectionsWithStudents.filter((s) => !takenToday.has(s.id)) : [];
  const markedCount = sectionsWithStudents.length - toMark.length;
  const counts = emptyCounts();
  for (const r of todayStatus) counts[r.status] = r._count;
  const presentPct = attendancePercent(counts);

  const sectionCount = classes.reduce((n, c) => n + c.sections.length, 0);
  const byGender = Object.fromEntries(genderCounts.map((g) => [g.gender ?? "NONE", g._count]));
  const classStrength = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections.length,
    students: c.sections.reduce((n, s) => n + s._count.students, 0),
  }));
  const maxStrength = Math.max(1, ...classStrength.map((c) => c.students));
  const maxHouse = Math.max(1, ...houses.map((h) => h._count.students));
  const issues = (unassignedStudents ? 1 : 0) + (sectionsWithoutTeacher.length ? 1 : 0) + (toMark.length ? 1 : 0);

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = viewer?.kind === "admin" ? viewer.admin.name.split(/\s+/)[0] : null;

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        subtitle={`Here's ${school.name} at a glance · Session ${session.name}`}
        action={
          <>
            <MoreMenu text="Quick add">
              <MenuLink href="/admin/teachers/new" icon={<Presentation />}>
                Add teacher
              </MenuLink>
              <MenuLink href="/admin/students/import" icon={<FileSpreadsheet />}>
                Bulk upload students
              </MenuLink>
              <MenuLink href="/admin/fees/collect" icon={<Wallet />}>
                Collect fee
              </MenuLink>
              <MenuLink href="/admin/notices" icon={<Megaphone />}>
                Send a notice
              </MenuLink>
              <MenuLink href="/admin/exams/new" icon={<ClipboardList />}>
                Create exam or test
              </MenuLink>
            </MoreMenu>
            <ButtonLink href="/admin/students/new" icon={UserPlus}>
              Add student
            </ButtonLink>
          </>
        }
      />

      {upcoming && (
        <Callout
          icon={Rocket}
          href="/admin/sessions"
          className="mb-6"
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

      {/* Today */}
      <div className="grid gap-4 lg:grid-cols-3">
        <HeroCard
          icon={CalendarCheck}
          eyebrow="Attendance today"
          className="lg:col-span-2"
          actions={
            <>
              {toMark.length > 0 ? (
                <HeroLink href={`/admin/attendance/${toMark[0].id}?date=${win.today}`}>
                  Take attendance · {sectionLabel(toMark[0])}
                  <ArrowRight />
                </HeroLink>
              ) : (
                attendanceDue &&
                !todayHoliday && (
                  <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-medium">
                    <CircleCheck className="h-4 w-4" /> Every class is marked
                  </span>
                )
              )}
              <HeroGhostLink href="/admin/attendance">Overview</HeroGhostLink>
            </>
          }
        >
          {todayHoliday || !attendanceDue ? (
            <>
              <p className="mt-4 flex items-center gap-3 text-display-sm font-semibold">
                {todayHoliday ? <CalendarOff className="h-8 w-8" aria-hidden /> : <Sun className="h-8 w-8" aria-hidden />}
                {todayHoliday ? todayHoliday.name : "Day off"}
              </p>
              <p className="mt-2 text-sm text-white/80">
                {todayHoliday ? "School holiday — no attendance is taken today." : "No attendance is due today. Enjoy the break."}
              </p>
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="text-display font-semibold">
                  {presentPct != null ? <AnimatedNumber value={Math.round(presentPct)} suffix="%" /> : <AnimatedNumber value={toMark.length} />}
                </p>
                <p className="pb-2 text-sm text-white/80">
                  {presentPct != null ? `present across ${markedCount} marked class(es)` : `class(es) waiting to be marked`}
                </p>
              </div>
              <HeroProgress label="Classes marked" value={markedCount} max={sectionsWithStudents.length} />
            </>
          )}
        </HeroCard>

        <section className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <p className="flex items-center gap-2 text-eyebrow uppercase text-muted">
            <IndianRupee className="h-4 w-4" aria-hidden /> Fees collected today
          </p>
          <p className="mt-4 text-display-sm font-semibold text-fg">
            <AnimatedNumber value={feesToday._sum.total ?? 0} prefix="₹" />
          </p>
          <p className="mt-1 text-sm text-muted">{feesToday._count ? `${feesToday._count} receipt(s)` : "No receipts yet today"}</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-8">
            <ButtonLink href="/admin/fees/collect" icon={Wallet} variant="secondary">
              Collect fee
            </ButtonLink>
            <ButtonLink href="/admin/fees" variant="ghost">
              Overview
            </ButtonLink>
          </div>
        </section>
      </div>

      <div className="mt-6">
        <StatGrid>
          <StatCard
            href="/admin/students"
            icon={GraduationCap}
            tone="indigo"
            label="Active students"
            value={studentCount}
            detail={
              byGender.MALE || byGender.FEMALE
                ? `${plural(byGender.MALE ?? 0, "boy")} · ${plural(byGender.FEMALE ?? 0, "girl")}`
                : `Across ${classes.length} classes`
            }
          />
          <StatCard href="/admin/teachers" icon={Presentation} tone="emerald" label="Teachers" value={teacherCount} detail={`${classTeacherCount} class teachers`} />
          <StatCard href="/admin/classes" icon={School} tone="sky" label="Classes" value={classes.length} detail={`${sectionCount} sections`} />
          <StatCard href="/admin/subjects" icon={BookOpen} tone="violet" label="Subjects" value={subjectCount} detail="Offered across the school" />
        </StatGrid>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          title="Students by class"
          description="Active students in each class"
          className="xl:col-span-2"
          action={<TextLink href="/admin/classes">View classes</TextLink>}
        >
          {classStrength.length === 0 ? (
            <EmptyState
              icon={School}
              title="No classes yet"
              description="Create classes to see their strength here."
              action={<ButtonLink href="/admin/classes">Create classes</ButtonLink>}
            />
          ) : (
            <ul className="space-y-4">
              {classStrength.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/classes/${c.id}`} className="group block rounded-lg">
                    <div className="mb-2 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-fg-2 transition group-hover:text-accent-text">{c.name}</span>
                      <span className="tabular-nums text-muted">
                        <span className="font-semibold text-fg">{c.students}</span> students · {c.sections} sections
                      </span>
                    </div>
                    <ProgressBar value={Math.max(c.students ? 3 : 0, (c.students / maxStrength) * 100)} label={`${c.name} strength`} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Needs attention"
          description={issues ? `${issues} item(s) to review` : "Everything is in order"}
          icon={issues ? TriangleAlert : CircleCheck}
        >
          <ul className="space-y-3">
            <AttentionItem ok={!toMark.length} href="/admin/attendance">
              {todayHoliday
                ? `Today is a holiday: ${todayHoliday.name}`
                : toMark.length
                  ? `${toMark.length} class(es) haven't taken attendance today`
                  : attendanceDue
                    ? "Attendance is taken for every class today"
                    : "No attendance due today"}
            </AttentionItem>
            <AttentionItem ok={!unassignedStudents} href="/admin/students">
              {unassignedStudents ? `${unassignedStudents} student(s) not assigned to a class` : "All students are assigned to a class"}
            </AttentionItem>
            <AttentionItem ok={!sectionsWithoutTeacher.length}>
              {sectionsWithoutTeacher.length ? (
                <>
                  {sectionsWithoutTeacher.length} section(s) without a class teacher
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {sectionsWithoutTeacher.slice(0, 12).map((s) => (
                      <Link key={s.id} href={`/admin/classes/${s.classId}`} className="rounded-full">
                        <Badge tone="amber">{sectionLabel(s)}</Badge>
                      </Link>
                    ))}
                    {sectionsWithoutTeacher.length > 12 && <Badge>+{sectionsWithoutTeacher.length - 12} more</Badge>}
                  </span>
                </>
              ) : (
                "Every section has a class teacher"
              )}
            </AttentionItem>
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Recent admissions"
          description="The latest students added"
          padded={false}
          action={<TextLink href="/admin/students">View all</TextLink>}
        >
          {recentStudents.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No students yet"
              description="Add students one by one or upload an Excel sheet."
              action={
                <>
                  <ButtonLink href="/admin/students/new" icon={UserPlus}>
                    Add student
                  </ButtonLink>
                  <ButtonLink href="/admin/students/import" icon={FileSpreadsheet} variant="secondary">
                    Bulk upload
                  </ButtonLink>
                </>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {recentStudents.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="group flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-2 sm:px-6"
                  >
                    <PersonCell name={fullName(s)} photoUrl={photoUrl(s.photoId)} sub={<span className="font-mono">{s.studentCode}</span>} />
                    <div className="flex items-center gap-3">
                      {s.section ? <Badge tone="indigo">{sectionLabel(s.section)}</Badge> : <Badge tone="amber">No class</Badge>}
                      <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Houses"
          icon={Shield}
          description={houses.length ? "Active students per house" : "No houses yet"}
          action={<TextLink href="/admin/houses">Manage</TextLink>}
          className="self-start"
        >
          {houses.length === 0 ? (
            <EmptyState
              compact
              icon={Shield}
              title="No houses yet"
              description="Create houses like Red House or Green House and assign students."
              action={
                <ButtonLink href="/admin/houses" variant="secondary" size="sm">
                  Create houses
                </ButtonLink>
              }
            />
          ) : (
            <ul className="space-y-3">
              {houses.map((h) => {
                const c = houseColor(h.color);
                return (
                  <li key={h.id}>
                    <Link href={`/admin/houses/${h.id}`} className="group block rounded-lg">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-fg-2 transition group-hover:text-accent-text">
                          <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                          {h.name}
                        </span>
                        <span className="tabular-nums text-muted">{h._count.students}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className={`h-full rounded-full ${c.dot}`}
                          style={{ width: `${Math.max(h._count.students ? 3 : 0, (h._count.students / maxHouse) * 100)}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function AttentionItem({ ok, href, children }: { ok: boolean; href?: string; children: React.ReactNode }) {
  const body = (
    <div
      className={`flex items-start gap-3 rounded-xl p-3 text-sm transition ${
        ok ? "bg-surface-2 text-fg-2" : "bg-warning-soft text-fg ring-1 ring-inset ring-warning-line"
      } ${href && !ok ? "hover:-translate-y-px hover:shadow-lift" : ""}`}
    >
      {ok ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
      ) : (
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
  return (
    <li>
      {href && !ok ? (
        <Link href={href} className="block rounded-xl">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}
