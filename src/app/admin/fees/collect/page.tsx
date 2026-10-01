import Link from "next/link";
import { ArrowLeft, ChevronRight, HandCoins, School, SearchX, Users } from "lucide-react";
import { ListToolbar, ResetFilters, SearchBox } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import {
  Badge,
  ButtonLink,
  Card,
  Dash,
  EmptyState,
  IconTile,
  PersonCell,
  Table,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, outstandingByStudent } from "@/lib/fees";
import { rupees } from "@/lib/fees-shared";
import { paginate } from "@/lib/pagination";
import { fullName, sectionLabel } from "@/lib/queries";

/**
 * Collect fees: pick a class and section (or search the whole school), then a
 * student. Sections show how many students they have and what is due now.
 */
export default async function CollectPage({ searchParams }: PageProps<"/admin/fees/collect">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sectionId = typeof sp.section === "string" ? sp.section : "";
  const { school } = await getFeesAccess();

  const section = sectionId
    ? await db.section.findFirst({
        where: { id: sectionId, class: { schoolId: school.id } },
        include: { class: true, classTeacher: { select: { firstName: true, middleName: true, lastName: true } } },
      })
    : null;

  return (
    <div className="space-y-6">
      {section && (
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href="/admin/fees/collect" variant="secondary" size="lg" icon={ArrowLeft}>
            All classes
          </ButtonLink>
          <div className="min-w-0">
            <p className="text-eyebrow uppercase text-muted">{section.class.name}</p>
            <h2 className="text-h2 font-semibold text-fg">Section {section.name}</h2>
          </div>
          {section.classTeacher && <Badge tone="indigo">Class teacher · {fullName(section.classTeacher)}</Badge>}
        </div>
      )}

      <Card padded={false}>
        <div className="border-b border-line px-4 py-4 sm:px-6">
          <ListToolbar>
            <SearchBox placeholder={section ? `Search ${sectionLabel(section)}…` : "Search any student: name, ID, father's name or phone…"} />
            <ResetFilters keys={["q"]} />
          </ListToolbar>
        </div>
        {q || section ? <StudentList schoolId={school.id} q={q} sectionId={section?.id ?? null} sp={sp} /> : <ClassGrid schoolId={school.id} />}
      </Card>
    </div>
  );
}

/** Every class with its sections as cards: students and fees due now. */
async function ClassGrid({ schoolId }: { schoolId: string }) {
  const [classes, students] = await Promise.all([
    db.schoolClass.findMany({
      where: { schoolId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { sections: { orderBy: { name: "asc" }, include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } } },
    }),
    db.student.findMany({ where: { schoolId, status: "ACTIVE", sectionId: { not: null } }, select: { id: true, sectionId: true } }),
  ]);
  const dues = await outstandingByStudent(schoolId);
  const bySection = new Map<string, { due: number; owing: number }>();
  for (const s of students) {
    const d = dues.get(s.id)?.dueNow ?? 0;
    const row = bySection.get(s.sectionId!) ?? { due: 0, owing: 0 };
    row.due += d;
    if (d > 0) row.owing++;
    bySection.set(s.sectionId!, row);
  }

  if (!classes.some((c) => c.sections.length)) {
    return <EmptyState icon={School} title="No classes yet" description="Add classes and sections first, then collect fees class by class." />;
  }
  return (
    <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 2xl:grid-cols-3">
      {classes
        .filter((c) => c.sections.length)
        .map((c) => {
          const totalStudents = c.sections.reduce((n, s) => n + s._count.students, 0);
          const totalDue = c.sections.reduce((n, s) => n + (bySection.get(s.id)?.due ?? 0), 0);
          return (
            <section key={c.id} className="rounded-2xl border border-line bg-surface-2/50 p-4">
              <header className="mb-3 flex items-center gap-3">
                <IconTile icon={School} tone="indigo" size="sm" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-fg">{c.name}</h3>
                  <p className="text-xs text-muted">
                    {totalStudents} student{totalStudents === 1 ? "" : "s"} · {c.sections.length} section{c.sections.length === 1 ? "" : "s"}
                  </p>
                </div>
                {totalDue > 0 && <span className="text-sm font-semibold tabular-nums text-danger">{rupees(totalDue)}</span>}
              </header>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {c.sections.map((s) => {
                  const d = bySection.get(s.id);
                  return (
                    <Link
                      key={s.id}
                      href={`/admin/fees/collect?section=${s.id}`}
                      className="group rounded-xl border border-line bg-surface p-3 shadow-card transition hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lift"
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-fg">{s.name}</span>
                        <ChevronRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Users className="h-3 w-3" aria-hidden /> {s._count.students}
                      </span>
                      <span className={`mt-1 block text-xs font-medium tabular-nums ${d?.due ? "text-danger" : "text-success"}`}>
                        {d?.due ? `${rupees(d.due)} due · ${d.owing} student${d.owing === 1 ? "" : "s"}` : "All clear"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
}

/** Students of one section, or search results across the school, with what each owes. */
async function StudentList({ schoolId, q, sectionId, sp }: { schoolId: string; q: string; sectionId: string | null; sp: Record<string, string | string[] | undefined> }) {
  const where = {
    schoolId,
    status: "ACTIVE" as const,
    ...(sectionId ? { sectionId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { studentCode: { contains: q, mode: "insensitive" as const } },
            { fatherName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
  const total = await db.student.count({ where });
  const paging = paginate(sp, total);
  const students = await db.student.findMany({
    where,
    orderBy: [{ section: { class: { sortOrder: "asc" } } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }, { id: "asc" }],
    skip: paging.skip,
    take: paging.take,
    include: { section: { include: { class: true } } },
  });
  const dues = students.length ? await outstandingByStudent(schoolId, { id: { in: students.map((s) => s.id) } }) : new Map();

  if (!students.length) {
    return <EmptyState icon={q ? SearchX : Users} title={q ? "No students found" : "No students in this section"} description={q ? "Try part of the name, the student ID or a phone number." : undefined} />;
  }
  return (
    <>
      <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted sm:px-6">
        {q ? <>Results for “{q}”</> : "Students"} · {total.toLocaleString("en-IN")} student{total === 1 ? "" : "s"}
      </p>
      <Table>
        <thead className={theadClass}>
          <tr>
            <th className={thClass}>Student</th>
            {!sectionId && <th className={`${thClass} hidden md:table-cell`}>Class</th>}
            <th className={`${thClass} hidden lg:table-cell`}>Father</th>
            <th className={`${thClass} hidden text-right sm:table-cell`}>Paid</th>
            <th className={`${thClass} text-right`}>Due now</th>
            <th className={thClass}>
              <span className="sr-only">Collect</span>
            </th>
          </tr>
        </thead>
        <tbody className={tbodyClass}>
          {students.map((s) => {
            const d = dues.get(s.id);
            return (
              <tr key={s.id} className={trClass}>
                <td className={tdClass}>
                  <PersonCell name={fullName(s)} href={`/admin/fees/students/${s.id}`} sub={`${s.studentCode}${s.rollNumber != null ? ` · Roll ${s.rollNumber}` : ""}`} size="sm" />
                </td>
                {!sectionId && <td className={`${tdClass} hidden md:table-cell`}>{s.section ? sectionLabel(s.section) : <Dash />}</td>}
                <td className={`${tdClass} hidden lg:table-cell`}>{s.fatherName ?? <Dash />}</td>
                <td className={`${tdClass} hidden text-right tabular-nums sm:table-cell`}>{d ? rupees(d.paid) : <Dash />}</td>
                <td className={`${tdClass} text-right font-semibold tabular-nums ${d?.dueNow ? "text-danger" : "text-success"}`}>{d ? (d.dueNow ? rupees(d.dueNow) : "Clear") : <Dash />}</td>
                <td className={`${tdClass} text-right`}>
                  {d?.dueNow ? (
                    <ButtonLink href={`/admin/fees/students/${s.id}`} size="sm" icon={HandCoins}>
                      Collect
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/admin/fees/students/${s.id}`} size="sm" variant="ghost">
                      View
                      <ChevronRight className="h-4 w-4" />
                    </ButtonLink>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pagination paging={paging} noun="students" />
    </>
  );
}
