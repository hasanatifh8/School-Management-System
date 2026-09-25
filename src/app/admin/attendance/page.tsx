import Link from "next/link";
import { CalendarCheck, CalendarOff, Phone, Sun, UserRoundX, Users } from "lucide-react";
import { DateNav } from "@/components/attendance/date-nav";
import { UpcomingHolidays } from "@/components/attendance/upcoming-holidays";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  IconTile,
  PageHeader,
  PersonCell,
  Table,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
  type IconTone,
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

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${formatISO(date)} · Session ${win.session.name}`}
        action={
          <ButtonLink href="/admin/attendance/holidays" variant="secondary" icon={CalendarOff}>
            Holidays
          </ButtonLink>
        }
      />
      <div className="mb-6">
        <DateNav basePath="/admin/attendance" date={date} min={win.min} max={win.max} />
      </div>

      {holiday ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 px-5 py-4 text-sm text-violet-900">
          <CalendarOff className="h-5 w-5 text-violet-500" />
          <span>
            <strong>School holiday: {holiday.name}.</strong> No attendance is taken today.
          </span>
        </div>
      ) : (
        isSunday(date) && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-sm text-amber-900">
            <Sun className="h-5 w-5 text-amber-500" />
            Sunday is a weekly off. Classes that were open can still take attendance.
          </div>
        )
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat icon={CalendarCheck} tone="indigo" label="Classes marked" value={`${markedCount} / ${withStudents.length}`} detail={holiday ? "School holiday" : toMark > 0 ? `${toMark} still to mark` : "All done"} />
        <Stat icon={Users} tone="emerald" label="Attending" value={String(total.PRESENT + total.LATE + total.HALF_DAY)} detail={percent == null ? "Nothing marked yet" : `${percent}% attendance`} />
        <Stat icon={UserRoundX} tone="rose" label="Absent" value={String(total.ABSENT)} detail={total.LEAVE ? `${total.LEAVE} on leave` : "Across marked classes"} />
        <Stat icon={CalendarOff} tone="violet" label="Classes off" value={String(classOff)} detail={holiday ? holiday.name : "Class holidays today"} />
      </div>

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
                    <th key={s} title={STATUS_META[s].label} className={`${thClass} !px-2 text-center ${STATUS_META[s].text}`}>
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
                      <p className="font-medium text-slate-900">{sectionLabel(s)}</p>
                      <p className="text-xs text-slate-500">
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
                      <td key={st} className={`${tdClass} !px-2 text-center tabular-nums`}>
                        {marked ? counts[st] : <span className="text-slate-300">–</span>}
                      </td>
                    ))}
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <Link href={`/admin/attendance/${s.id}?date=${date}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                        {marked ? "Edit" : holiday ? "View" : "Take"}
                      </Link>
                      <Link href={`/admin/attendance/${s.id}/register?month=${date.slice(0, 7)}`} className="ml-4 text-slate-500 hover:text-slate-800">
                        Register
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6 self-start">
          <Card title="Absent" icon={UserRoundX} description={absentees.length ? `${absentees.length} student(s)` : undefined} padded={false}>
            {absentees.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">{markedCount ? "No one is absent." : "No attendance marked yet."}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
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
                      <a href={`tel:${a.student.phone}`} title={`Call ${a.student.phone}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <UpcomingHolidays
            schoolId={school.id}
            from={win.today}
            action={
              <Link href="/admin/attendance/holidays" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Manage
              </Link>
            }
          />
        </div>
      </div>
    </>
  );
}

function Stat({ icon, tone, label, value, detail }: { icon: typeof Users; tone: IconTone; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <IconTile icon={icon} tone={tone} />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}
