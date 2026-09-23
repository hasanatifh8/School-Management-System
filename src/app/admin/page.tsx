import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  GraduationCap,
  Presentation,
  School,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  IconTile,
  PageHeader,
  PersonCell,
  type IconTone,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";

export default async function DashboardPage() {
  const school = await getCurrentSchool();
  const active = { schoolId: school.id, status: "ACTIVE" as const };

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
  ] = await Promise.all([
    db.student.count({ where: active }),
    db.student.groupBy({ by: ["gender"], where: active, _count: true }),
    db.teacher.count({ where: active }),
    db.section.count({ where: { class: { schoolId: school.id }, classTeacherId: { not: null } } }),
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        sections: { include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } },
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
  ]);

  const sectionCount = classes.reduce((n, c) => n + c.sections.length, 0);
  const byGender = Object.fromEntries(genderCounts.map((g) => [g.gender ?? "NONE", g._count]));
  const classStrength = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections.length,
    students: c.sections.reduce((n, s) => n + s._count.students, 0),
  }));
  const maxStrength = Math.max(1, ...classStrength.map((c) => c.students));
  const issues = (unassignedStudents ? 1 : 0) + (sectionsWithoutTeacher.length ? 1 : 0);

  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${today} · Overview of ${school.name}`}
        action={
          <>
            <ButtonLink href="/admin/teachers/new" variant="secondary" icon={Presentation}>
              Add teacher
            </ButtonLink>
            <ButtonLink href="/admin/students/new" icon={UserPlus}>
              Add student
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
        <StatCard
          href="/admin/teachers"
          icon={Presentation}
          tone="emerald"
          label="Teachers"
          value={teacherCount}
          detail={`${classTeacherCount} serving as class teacher`}
        />
        <StatCard
          href="/admin/classes"
          icon={School}
          tone="sky"
          label="Classes"
          value={classes.length}
          detail={`${sectionCount} sections in total`}
        />
        <StatCard
          href="/admin/subjects"
          icon={BookOpen}
          tone="violet"
          label="Subjects"
          value={subjectCount}
          detail="Offered across the school"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          title="Students by class"
          description="Active students in each class"
          className="xl:col-span-2"
          action={
            <Link href="/admin/classes" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View classes
            </Link>
          }
        >
          {classStrength.length === 0 ? (
            <EmptyState icon={School} title="No classes yet" description="Create classes to see their strength here." />
          ) : (
            <ul className="space-y-4">
              {classStrength.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/classes/${c.id}`} className="group block">
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-slate-700 group-hover:text-indigo-600">{c.name}</span>
                      <span className="tabular-nums text-slate-500">
                        <span className="font-semibold text-slate-900">{c.students}</span> students ·{" "}
                        {c.sections} sections
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all group-hover:from-indigo-600 group-hover:to-violet-600"
                        style={{ width: `${Math.max(c.students ? 3 : 0, (c.students / maxStrength) * 100)}%` }}
                      />
                    </div>
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
            <AttentionItem ok={!unassignedStudents} href="/admin/students">
              {unassignedStudents
                ? `${unassignedStudents} student(s) not assigned to a class`
                : "All students are assigned to a class"}
            </AttentionItem>
            <AttentionItem ok={!sectionsWithoutTeacher.length}>
              {sectionsWithoutTeacher.length ? (
                <>
                  {sectionsWithoutTeacher.length} section(s) without a class teacher
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {sectionsWithoutTeacher.slice(0, 12).map((s) => (
                      <Link key={s.id} href={`/admin/classes/${s.classId}`}>
                        <Badge tone="amber">{sectionLabel(s)}</Badge>
                      </Link>
                    ))}
                    {sectionsWithoutTeacher.length > 12 && (
                      <Badge>+{sectionsWithoutTeacher.length - 12} more</Badge>
                    )}
                  </span>
                </>
              ) : (
                "Every section has a class teacher"
              )}
            </AttentionItem>
          </ul>
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="Recent admissions"
          description="The latest students added"
          padded={false}
          action={
            <Link href="/admin/students" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View all
            </Link>
          }
        >
          {recentStudents.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No students yet"
              action={
                <ButtonLink href="/admin/students/new" icon={UserPlus}>
                  Add student
                </ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentStudents.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-3.5 transition hover:bg-slate-50/70"
                  >
                    <PersonCell
                      name={fullName(s)}
                      photoUrl={photoUrl(s.photoId)}
                      sub={<span className="font-mono">{s.studentCode}</span>}
                    />
                    <div className="flex items-center gap-3">
                      {s.section ? (
                        <Badge tone="indigo">{sectionLabel(s.section)}</Badge>
                      ) : (
                        <Badge tone="amber">No class</Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </Link>
                </li>
              ))}
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

function StatCard({
  href,
  icon,
  tone,
  label,
  value,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  tone: IconTone;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <IconTile icon={icon} tone={tone} />
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500 sm:mt-4">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </Link>
  );
}

function AttentionItem({
  ok,
  href,
  children,
}: {
  ok: boolean;
  href?: string;
  children: React.ReactNode;
}) {
  const body = (
    <div
      className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
        ok ? "bg-slate-50 text-slate-600" : "bg-amber-50/70 text-amber-900"
      }`}
    >
      {ok ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
  return <li>{href && !ok ? <Link href={href}>{body}</Link> : body}</li>;
}
