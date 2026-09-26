import Link from "next/link";
import { CalendarCheck, CalendarOff, Megaphone, PartyPopper, Phone, Sun, Table2, UserRoundX, Users } from "lucide-react";
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
  Table,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { attendanceWindow, pickDate } from "@/lib/attendance";
import {
  ATTENDANCE_STATUSES,
  STATUS_META,
  attendancePercent,
  emptyCounts,
  formatISO,
  isSunday,
  parseISODate,
} from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

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
        <Card title="Classes" padded={false} className="xl:col-span-2">
          {sections.length === 0 ? (
            <EmptyState icon={Users} title="No classes yet" description="Create classes and sections to take attendance." />
          ) : (
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Class</th>
                  <th className={thClass}>Status</th>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <th key={s} title={STATUS_META[s].label} className={`${thClass} hidden !px-2 text-center md:table-cell ${STATUS_META[s].text}`}>
                      {STATUS_META[s].short}
                    </th>
                  ))}
                  <th className={`${thClass} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {rows.map(({ section: s, day, counts, marked }) => (
                  <tr key={s.id} className={trClass}>
                    <td className={tdClass}>
                      <p className="font-medium text-fg">{sectionLabel(s)}</p>
                      <p className="text-xs text-muted">
                        {s._count.students} students · {s.classTeacher ? fullName(s.classTeacher) : "No class teacher"}
                      </p>
                    </td>
                    <td className={tdClass}>
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
                    </td>
                    {ATTENDANCE_STATUSES.map((st) => (
                      <td key={st} className={`${tdClass} hidden !px-2 text-center tabular-nums md:table-cell`}>
                        {marked ? counts[st] : <span className="text-subtle">–</span>}
                      </td>
                    ))}
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <ButtonLink
                          href={`/admin/attendance/${s.id}?date=${date}`}
                          size="sm"
                          variant={marked || holiday || day?.holiday || !s._count.students ? "ghost" : "primary"}
                        >
                          {marked ? "Edit" : holiday || day?.holiday || !s._count.students ? "View" : "Take"}
                        </ButtonLink>
                        <Link
                          href={`/admin/attendance/register?section=${s.id}&period=month&month=${date.slice(0, 7)}`}
                          title="Monthly register"
                          aria-label={`Monthly register for ${sectionLabel(s)}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-surface-3 hover:text-fg"
                        >
                          <Table2 className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

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
