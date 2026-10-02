import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarOff, Megaphone, PartyPopper, Phone, School, Sun, Table2, UserRoundX, Users } from "lucide-react";
import { DateNav } from "@/components/attendance/date-nav";
import { UpcomingHolidays } from "@/components/attendance/upcoming-holidays";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  MenuLink,
  MoreMenu,
  PagedList,
  PageHeader,
  PersonCell,
  StatCard,
  StatGrid,
} from "@/components/ui";
import { attendanceWindow, pickDate } from "@/lib/attendance";
import {
  ATTENDANCE_STATUSES,
  attendancePercent,
  emptyCounts,
  formatISO,
  isSunday,
  parseISODate,
} from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel, shortSectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { AttendanceTabs } from "./attendance-tabs";

/** Every class's attendance for one day, with the list of absent students. */
export default async function AttendanceOverviewPage({ searchParams }: PageProps<"/admin/attendance">) {
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const date = pickDate((await searchParams).date, win);
  const d = parseISODate(date)!;

  const [classes, days, holiday] = await Promise.all([
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        sections: {
          orderBy: { name: "asc" },
          include: {
            classTeacher: { select: { firstName: true, middleName: true, lastName: true } },
            _count: { select: { students: { where: { status: "ACTIVE" } } } },
          },
        },
      },
    }),
    db.attendanceDay.findMany({
      where: { schoolId: school.id, date: d },
      include: {
        records: {
          select: {
            status: true,
            remark: true,
            student: {
              select: { id: true, firstName: true, middleName: true, lastName: true, photoId: true, fatherName: true, phone: true },
            },
          },
        },
      },
    }),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId: school.id, date: d } } }),
  ]);

  const dayBySection = new Map(days.map((x) => [x.sectionId, x]));
  const sections = classes.flatMap((c) => c.sections.map((s) => ({ ...s, class: c })));
  const withStudents = sections.filter((s) => s._count.students > 0);
  const rows = sections.map((s) => {
    const day = dayBySection.get(s.id);
    const counts = emptyCounts();
    const marked = !holiday && !!day && !day.holiday && day.records.length > 0;
    for (const r of marked ? day.records : []) counts[r.status]++;
    return { section: s, day, counts, marked };
  });
  const total = emptyCounts();
  for (const r of rows) for (const st of ATTENDANCE_STATUSES) total[st] += r.counts[st];
  const markedCount = rows.filter((r) => r.marked).length;
  const classOff = rows.filter((r) => r.day?.holiday).length;
  const toMark = withStudents.length - markedCount - rows.filter((r) => r.day?.holiday && r.section._count.students > 0).length;
  const absentees = holiday
    ? []
    : days
        .filter((x) => !x.holiday)
        .flatMap((x) =>
          x.records.filter((r) => r.status === "ABSENT").map((r) => ({ ...r, section: sections.find((s) => s.id === x.sectionId)! })),
        );
  const percent = attendancePercent(total);
  const nextToMark = holiday ? null : rows.find((r) => !r.marked && !r.day?.holiday && r.section._count.students > 0);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${formatISO(date)} · Session ${win.session.name}`}
        action={
          <>
            <MoreMenu>
              <MenuLink href="/admin/attendance/holidays" icon={<CalendarOff />}>
                School holidays
              </MenuLink>
              {nextToMark && (
                <MenuLink href={`/admin/attendance/${nextToMark.section.id}?date=${date}`} icon={<CalendarCheck />}>
                  Take attendance · {sectionLabel(nextToMark.section)}
                </MenuLink>
              )}
              {absentees.length > 0 && (
                <MenuLink href={`/admin/notices?absent=${date}`} icon={<Megaphone />}>
                  Message absent parents
                </MenuLink>
              )}
            </MoreMenu>
            <ButtonLink href={`/admin/attendance/register?period=month&month=${date.slice(0, 7)}`} icon={Table2}>
              Attendance register
            </ButtonLink>
          </>
        }
      />
      <AttendanceTabs active="students" date={date} />
      <div className="mb-6">
        <DateNav basePath="/admin/attendance" date={date} min={win.min} max={win.max} />
      </div>

      {holiday ? (
        <Callout icon={CalendarOff} className="mb-6">
          <strong className="font-semibold">School holiday: {holiday.name}.</strong> No attendance is taken today.
        </Callout>
      ) : (
        isSunday(date) && (
          <Callout icon={Sun} tone="warning" className="mb-6">
            Sunday is a weekly off. Classes that were open can still take attendance.
          </Callout>
        )
      )}

      <StatGrid>
        <StatCard icon={CalendarCheck} tone="indigo" label="Classes marked" value={`${markedCount} / ${withStudents.length}`} detail={holiday ? "School holiday" : toMark > 0 ? `${toMark} still to mark` : "All done"} />
        <StatCard icon={Users} tone="emerald" label="Attending" value={total.PRESENT + total.LATE + total.HALF_DAY} detail={percent == null ? "Nothing marked yet" : `${percent}% attendance`} />
        <StatCard icon={UserRoundX} tone="rose" label="Absent" value={total.ABSENT} detail={total.LEAVE ? `${total.LEAVE} on leave` : "Across marked classes"} />
        <StatCard icon={CalendarOff} tone="violet" label="Classes off" value={classOff} detail={holiday ? holiday.name : "Class holidays today"} />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {classes.length === 0 ? (
            <Card>
              <EmptyState icon={Users} title="No classes yet" description="Create classes and sections to take attendance." />
            </Card>
          ) : (
            classes.map((c) => {
              const tiles = rows.filter((r) => r.section.classId === c.id);
              const done = tiles.filter((r) => r.marked || r.day?.holiday).length;
              return (
                <Card
                  key={c.id}
                  title={c.name}
                  icon={School}
                  description={tiles.length ? `${done} of ${tiles.length} section${tiles.length === 1 ? "" : "s"} done` : "No sections"}
                >
                  {tiles.length === 0 ? (
                    <p className="text-sm text-muted">Add a section to this class to take attendance.</p>
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {tiles.map(({ section: s, day, counts, marked }) => {
                        const open = !holiday && !day?.holiday && s._count.students > 0;
                        return (
                          <li key={s.id} className="relative">
                            <Link
                              href={`/admin/attendance/${s.id}?date=${date}`}
                              className={`group block rounded-xl border p-4 transition hover:-translate-y-px hover:border-accent-line hover:bg-accent-soft ${
                                open && !marked ? "border-warning-line" : "border-line"
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2 pr-8">
                                <span className="text-lg font-semibold text-fg">{shortSectionLabel(c.name, s.name)}</span>
                              </span>
                              <span className="mt-1 block">
                                {holiday ? (
                                  <Badge tone="indigo">School holiday</Badge>
                                ) : day?.holiday ? (
                                  <span title={day.holiday}>
                                    <Badge tone="indigo">Off: {day.holiday}</Badge>
                                  </span>
                                ) : marked ? (
                                  <span title={day?.markedBy ? `Marked by ${day.markedBy}` : undefined}>
                                    <Badge tone="green" dot>
                                      Marked
                                    </Badge>
                                  </span>
                                ) : s._count.students === 0 ? (
                                  <Badge>No students</Badge>
                                ) : (
                                  <Badge tone="amber" dot>
                                    Not marked
                                  </Badge>
                                )}
                              </span>
                              <span className="mt-2 block text-xs text-muted">
                                {marked
                                  ? `${counts.PRESENT + counts.LATE + counts.HALF_DAY} of ${s._count.students} attending${counts.ABSENT ? ` · ${counts.ABSENT} absent` : ""}${counts.LEAVE ? ` · ${counts.LEAVE} on leave` : ""}`
                                  : `${s._count.students} students`}
                              </span>
                              <span className="block truncate text-xs text-subtle">{s.classTeacher ? fullName(s.classTeacher) : "No class teacher"}</span>
                              <span
                                className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${open && !marked ? "text-accent-text" : "text-muted group-hover:text-accent-text"}`}
                              >
                                {marked ? "Edit attendance" : open ? "Take attendance" : "View"}
                                <ArrowRight className="h-4 w-4" />
                              </span>
                            </Link>
                            <Link
                              href={`/admin/attendance/register?section=${s.id}&period=month&month=${date.slice(0, 7)}`}
                              title="Monthly register"
                              aria-label={`Monthly register for ${sectionLabel(s)}`}
                              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-surface-3 hover:text-fg"
                            >
                              <Table2 className="h-4 w-4" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-6 self-start">
          <Card
            title="Absent"
            icon={UserRoundX}
            description={absentees.length ? `${absentees.length} student(s)` : undefined}
            padded={false}
            action={
              absentees.length > 0 && (
                <Link href={`/admin/notices?absent=${date}`} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
                  Message parents
                </Link>
              )
            }
          >
            {absentees.length === 0 ? (
              <EmptyState compact icon={markedCount ? PartyPopper : UserRoundX} title={markedCount ? "No one is absent" : "No attendance marked yet"} />
            ) : (
              <PagedList pageSize={8} noun="absent">
                {absentees.map((a) => (
                  <li key={a.student.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <PersonCell
                        name={fullName(a.student)}
                        photoUrl={photoUrl(a.student.photoId)}
                        href={`/admin/students/${a.student.id}`}
                        size="sm"
                        sub={`${sectionLabel(a.section)}${a.remark ? ` · ${a.remark}` : ""}`}
                      />
                    </div>
                    {a.student.phone && (
                      <a href={`tel:${a.student.phone}`} title={`Call ${a.student.phone}`} className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-accent-text">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                ))}
              </PagedList>
            )}
          </Card>
          <UpcomingHolidays
            schoolId={school.id}
            from={win.today}
            action={
              <Link href="/admin/attendance/holidays" className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
                Manage
              </Link>
            }
          />
        </div>
      </div>
    </>
  );
}
