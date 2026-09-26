import Link from "next/link";
import { ArrowRight, BookOpen, Cake, CalendarCheck, CalendarOff, Hash, School, Sun, Users } from "lucide-react";
import { UpcomingHolidays } from "@/components/attendance/upcoming-holidays";
import { Badge, Callout, Card, EmptyState, HeroCard, HeroGhostLink, HeroLink, IconTile, PageHeader, PagedList, PersonCell, StatCard, TextLink } from "@/components/ui";
import { attendanceWindow } from "@/lib/attendance";
import { isSunday, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

const dayMonth = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function TeacherDashboard() {
  const ctx = await requireTeacher();
  const sectionIds = [...ctx.visibleSectionIds];

  const [classStudents, counts] = await Promise.all([
    ctx.classSection
      ? db.student.findMany({
          where: { sectionId: ctx.classSection.id, status: "ACTIVE" },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            rollNumber: true,
            photoId: true,
            studentCode: true,
          },
        })
      : Promise.resolve([]),
    db.student.groupBy({
      by: ["sectionId"],
      where: { sectionId: { in: sectionIds }, status: "ACTIVE" },
      _count: true,
    }),
  ]);
  const win = await attendanceWindow(ctx.school.id);
  const today = parseISODate(win.today)!;
  const [todayDay, todayHoliday] = await Promise.all([
    ctx.classSection
      ? db.attendanceDay.findUnique({
          where: {
            sectionId_date: { sectionId: ctx.classSection.id, date: today },
          },
          include: { records: { select: { status: true } } },
        })
      : null,
    db.holiday.findUnique({
      where: { schoolId_date: { schoolId: ctx.school.id, date: today } },
    }),
  ]);
  const countBySection = new Map(counts.map((c) => [c.sectionId, c._count]));
  const subjectOnly = ctx.subjectSections.filter((s) => s.section.id !== ctx.classSection?.id);
  // Every subject assignment, the teacher's own class first.
  const teaching = [...ctx.subjectSections].sort((a, b) => Number(b.section.id === ctx.classSection?.id) - Number(a.section.id === ctx.classSection?.id));
  const subjectCount = new Set(ctx.subjectSections.flatMap((s) => s.subjects)).size;
  const boys = classStudents.filter((s) => s.gender === "MALE").length;
  const girls = classStudents.filter((s) => s.gender === "FEMALE").length;
  const missingRolls = classStudents.filter((s) => s.rollNumber == null).length;
  const totalStudents = counts.reduce((n, c) => n + c._count, 0);

  const month =
    Number(
      new Intl.DateTimeFormat("en-IN", {
        month: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date()),
    ) - 1;
  const birthdays = classStudents
    .filter((s) => s.dateOfBirth && s.dateOfBirth.getUTCMonth() === month)
    .sort((a, b) => a.dateOfBirth!.getUTCDate() - b.dateOfBirth!.getUTCDate());

  const name = ctx.teacher.firstName;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${name}`}
        subtitle={`${ctx.school.name}${ctx.teacher.specialization ? ` · ${ctx.teacher.specialization}` : ""}`}
      />

      {!ctx.classSection && subjectOnly.length === 0 ? (
        <Card>
          <EmptyState
            icon={School}
            title="No classes assigned yet"
            description="Ask your school admin to make you a class teacher or a subject teacher. Your classes will appear here."
          />
        </Card>
      ) : (
        <>
          {ctx.classSection && win.today === win.max && (
            <TodayHero
              className="mb-6"
              section={sectionLabel(ctx.classSection)}
              date={win.today}
              holiday={todayHoliday?.name ?? todayDay?.holiday ?? null}
              records={todayDay?.holiday ? null : todayDay?.records.length ? todayDay.records : null}
              sunday={isSunday(win.today)}
            />
          )}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard
              icon={Users}
              tone="indigo"
              label="My class"
              value={ctx.classSection ? sectionLabel(ctx.classSection) : "—"}
              detail={ctx.classSection ? `${classStudents.length} students` : "Not a class teacher"}
              href={ctx.classSection ? "/teacher/class" : undefined}
            />
            <StatCard
              icon={BookOpen}
              tone="emerald"
              label="Subjects I teach"
              value={subjectCount}
              detail={teaching.length ? `in ${teaching.length} section${teaching.length === 1 ? "" : "s"}` : "none assigned"}
            />
            <div className="col-span-2 lg:col-span-1">
              <StatCard icon={School} tone="sky" label="Students I teach" value={totalStudents} detail="across all my classes" />
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              {ctx.classSection && (
                <Card
                  title={`My class · ${sectionLabel(ctx.classSection)}`}
                  icon={Users}
                  description="You are the class teacher."
                  action={<TextLink href="/teacher/class">Open class</TextLink>}
                >
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Mini label="Students" value={classStudents.length} />
                    <Mini label="Boys" value={boys} />
                    <Mini label="Girls" value={girls} />
                  </div>
                  {missingRolls > 0 && (
                    <Callout icon={Hash} tone="warning" href="/teacher/class" action="Assign →" className="mt-4 !py-3">
                      {missingRolls} student(s) have no roll number.
                    </Callout>
                  )}
                </Card>
              )}

              {teaching.length > 0 && (
                <Card title="Subjects I teach" icon={BookOpen} description="Where you are the subject teacher." padded={false}>
                  <ul className="divide-y divide-line">
                    {teaching.map((s) => (
                      <li key={s.section.id}>
                        <Link
                          href={s.section.id === ctx.classSection?.id ? "/teacher/class" : `/teacher/sections/${s.section.id}`}
                          className="group flex items-center gap-4 px-4 py-3 transition hover:bg-surface-2 sm:px-6"
                        >
                          <IconTile icon={BookOpen} tone="emerald" size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 font-medium text-fg">
                              {sectionLabel(s.section)}
                              {s.section.id === ctx.classSection?.id && <Badge tone="indigo">My class</Badge>}
                            </p>
                            <p className="truncate text-xs text-muted">{s.subjects.join(", ")}</p>
                          </div>
                          <Badge>{countBySection.get(s.section.id) ?? 0} students</Badge>
                          <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <div className="space-y-6 self-start">
              {ctx.classSection && (
                <Card title="Birthdays this month" icon={Cake} padded={false}>
                  {birthdays.length === 0 ? (
                    <EmptyState compact icon={Cake} title="No birthdays this month" />
                  ) : (
                    <PagedList pageSize={6} noun="birthdays">
                      {birthdays.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                          <PersonCell name={fullName(s)} photoUrl={photoUrl(s.photoId)} href={`/teacher/students/${s.id}`} size="sm" />
                          <Badge tone="amber">{dayMonth.format(s.dateOfBirth!)}</Badge>
                        </li>
                      ))}
                    </PagedList>
                  )}
                </Card>
              )}
              <UpcomingHolidays schoolId={ctx.school.id} from={win.today} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-2xl font-semibold tabular-nums text-fg">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

/** Today's attendance for the teacher's own class: the one thing to do first. */
function TodayHero({
  section,
  date,
  holiday,
  records,
  sunday,
  className,
}: {
  section: string;
  date: string;
  holiday: string | null;
  records: { status: string }[] | null;
  sunday: boolean;
  className?: string;
}) {
  if (holiday || (sunday && !records)) {
    return (
      <HeroCard icon={holiday ? CalendarOff : Sun} eyebrow={`Today · ${section}`} className={className}>
        <p className="mt-4 text-display-sm font-semibold">{holiday ?? "Sunday"}</p>
        <p className="mt-2 text-sm text-white/80">{holiday ? "Holiday — no attendance today." : "Weekly off. Take attendance only if the school is open."}</p>
      </HeroCard>
    );
  }
  if (records) {
    const attending = records.filter((r) => r.status !== "ABSENT" && r.status !== "LEAVE").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    return (
      <HeroCard
        icon={CalendarCheck}
        eyebrow={`Attendance today · ${section}`}
        className={className}
        actions={
          <>
            <HeroGhostLink href="/teacher/attendance">Edit attendance</HeroGhostLink>
            {absent > 0 && <HeroLink href={`/teacher/notices?absent=${date}`}>Message absent parents</HeroLink>}
          </>
        }
      >
        <p className="mt-4 text-display font-semibold tabular-nums">
          {attending}
          <span className="text-display-sm text-white/70"> / {records.length}</span>
        </p>
        <p className="text-sm text-white/80">attending{absent ? ` · ${absent} absent` : " · everyone's here"}</p>
      </HeroCard>
    );
  }
  return (
    <HeroCard
      icon={CalendarCheck}
      eyebrow={`Attendance today · ${section}`}
      className={className}
      actions={
        <HeroLink href="/teacher/attendance">
          Take attendance <ArrowRight />
        </HeroLink>
      }
    >
      <p className="mt-4 text-display-sm font-semibold">Not taken yet</p>
      <p className="mt-2 text-sm text-white/80">Everyone starts as present — tap only the exceptions. It takes under a minute.</p>
    </HeroCard>
  );
}
