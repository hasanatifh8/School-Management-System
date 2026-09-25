import Link from "next/link";
import { ArrowRight, BookOpen, Cake, CalendarCheck, CalendarOff, Hash, School, Users } from "lucide-react";
import { UpcomingHolidays } from "@/components/attendance/upcoming-holidays";
import { Badge, Card, EmptyState, IconTile, PageHeader, PersonCell } from "@/components/ui";
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Stat
              icon={Users}
              label="My class"
              value={ctx.classSection ? sectionLabel(ctx.classSection) : "—"}
              detail={ctx.classSection ? `${classStudents.length} students` : "Not a class teacher"}
            />
            <Stat
              icon={BookOpen}
              label="Subject classes"
              value={String(subjectOnly.length)}
              detail={subjectOnly.length ? "where you teach a subject" : "none"}
            />
            <Stat icon={School} label="Students I teach" value={String(totalStudents)} detail="across all my classes" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              {ctx.classSection && (
                <Card
                  title={`My class · ${sectionLabel(ctx.classSection)}`}
                  icon={Users}
                  description="You are the class teacher."
                  action={
                    <Link href="/teacher/class" className="text-sm font-medium text-teal-700 hover:text-teal-600">
                      Open class
                    </Link>
                  }
                >
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Mini label="Students" value={classStudents.length} />
                    <Mini label="Boys" value={boys} />
                    <Mini label="Girls" value={girls} />
                  </div>
                  <TodayAttendance
                    holiday={todayHoliday?.name ?? todayDay?.holiday ?? null}
                    records={todayDay?.holiday ? null : todayDay?.records.length ? todayDay.records : null}
                    sunday={isSunday(win.today)}
                    inSession={win.today === win.max}
                  />
                  {missingRolls > 0 && (
                    <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <Hash className="h-4 w-4" /> {missingRolls} student(s) have no roll number.{" "}
                      <Link href="/teacher/class" className="font-medium underline">
                        Assign
                      </Link>
                    </p>
                  )}
                </Card>
              )}

              {subjectOnly.length > 0 && (
                <Card title="Subject classes" icon={BookOpen} padded={false}>
                  <ul className="divide-y divide-slate-100">
                    {subjectOnly.map((s) => (
                      <li key={s.section.id}>
                        <Link
                          href={`/teacher/sections/${s.section.id}`}
                          className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-slate-50"
                        >
                          <IconTile icon={BookOpen} tone="emerald" size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">{sectionLabel(s.section)}</p>
                            <p className="truncate text-xs text-slate-500">{s.subjects.join(", ")}</p>
                          </div>
                          <Badge>{countBySection.get(s.section.id) ?? 0} students</Badge>
                          <ArrowRight className="h-4 w-4 text-slate-300" />
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
                    <p className="p-6 text-sm text-slate-500">No birthdays in your class this month.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {birthdays.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 px-6 py-3">
                          <PersonCell name={fullName(s)} photoUrl={photoUrl(s.photoId)} href={`/teacher/students/${s.id}`} size="sm" />
                          <Badge tone="amber">{dayMonth.format(s.dateOfBirth!)}</Badge>
                        </li>
                      ))}
                    </ul>
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

function Stat({ icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <IconTile icon={icon} tone="emerald" />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function TodayAttendance({
  holiday,
  records,
  sunday,
  inSession,
}: {
  holiday: string | null;
  records: { status: string }[] | null;
  sunday: boolean;
  inSession: boolean;
}) {
  if (!inSession) return null;
  const box = "mt-4 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm";
  if (holiday) {
    return (
      <p className={`${box} bg-violet-50 text-violet-800`}>
        <CalendarOff className="h-4 w-4" /> Holiday today: {holiday}
      </p>
    );
  }
  if (records) {
    const attending = records.filter((r) => r.status !== "ABSENT" && r.status !== "LEAVE").length;
    return (
      <p className={`${box} bg-emerald-50 text-emerald-800`}>
        <CalendarCheck className="h-4 w-4" /> Attendance taken today: {attending} of {records.length} attending.
        <Link href="/teacher/attendance" className="font-medium underline">
          View
        </Link>
      </p>
    );
  }
  if (sunday) return null;
  return (
    <p className={`${box} bg-amber-50 text-amber-800`}>
      <CalendarCheck className="h-4 w-4" /> Today&apos;s attendance isn&apos;t taken yet.
      <Link href="/teacher/attendance" className="font-medium underline">
        Take attendance
      </Link>
    </p>
  );
}
