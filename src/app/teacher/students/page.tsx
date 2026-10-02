import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { FilterSelect, ListToolbar, SearchBox } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

/** Every student in the sections the teacher teaches (their own class and subject classes). */
export default async function TeacherStudentsPage({ searchParams }: PageProps<"/teacher/students">) {
  const params = await searchParams;
  const ctx = await requireTeacher();
  const sections = [...(ctx.classSection ? [{ section: ctx.classSection, subjects: ["Class teacher"] }] : []), ...ctx.subjectSections.filter((s) => s.section.id !== ctx.classSection?.id)];
  const allowed = sections.map((s) => s.section.id);
  const section = typeof params.section === "string" && allowed.includes(params.section) ? params.section : null;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const words = q.split(/\s+/).filter(Boolean);

  const where: Prisma.StudentWhereInput = {
    schoolId: ctx.school.id,
    status: "ACTIVE",
    sectionId: section ? section : { in: allowed },
    AND: words.map((w) => ({
      OR: [
        { firstName: { contains: w, mode: "insensitive" as const } },
        { lastName: { contains: w, mode: "insensitive" as const } },
        { studentCode: { contains: w, mode: "insensitive" as const } },
        ...(/^\d+$/.test(w) ? [{ rollNumber: Number(w) }] : []),
      ],
    })),
  };
  const paging = paginate(params, await db.student.count({ where }));
  const students = await db.student.findMany({
    where,
    orderBy: [{ section: { class: { sortOrder: "asc" } } }, { section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
    skip: paging.skip,
    take: paging.take,
    select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, rollNumber: true, photoId: true, phone: true, sectionId: true, section: { include: { class: true } } },
  });
  const subjectsIn = new Map(sections.map((s) => [s.section.id, s.subjects.join(", ")]));

  return (
    <>
      <PageHeader title="Students" subtitle={`Students of the ${allowed.length} class${allowed.length === 1 ? "" : "es"} you teach.`} />
      {allowed.length === 0 ? (
        <Card>
          <EmptyState icon={GraduationCap} title="No classes assigned yet" description="Students appear here once you're a class or subject teacher." />
        </Card>
      ) : (
        <Card padded={false}>
          <ListToolbar>
            <SearchBox placeholder="Search name, ID or roll no." />
            <FilterSelect
              name="section"
              label="All my classes"
              options={sections.map((s) => ({ value: s.section.id, label: sectionLabel(s.section) }))}
            />
          </ListToolbar>
          {students.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No students match" />
          ) : (
            <ul className="divide-y divide-line">
              {students.map((s) => {
                const mine = s.sectionId === ctx.classSection?.id;
                return (
                  <li key={s.id}>
                    <Link
                      href={mine ? `/teacher/students/${s.id}` : `/teacher/sections/${s.sectionId}`}
                      className="group flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6"
                    >
                      <span className="w-7 shrink-0 text-right font-mono text-xs text-subtle">{s.rollNumber ?? "—"}</span>
                      <Avatar name={fullName(s)} src={photoUrl(s.photoId)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-fg group-hover:text-accent-text">{fullName(s)}</span>
                        <span className="block truncate text-xs text-muted">
                          <span className="font-mono">{s.studentCode}</span>
                          {s.sectionId && ` · ${subjectsIn.get(s.sectionId) ?? ""}`}
                        </span>
                      </span>
                      {s.section && <Badge tone={mine ? "indigo" : "slate"}>{sectionLabel(s.section)}</Badge>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination paging={paging} noun="students" />
        </Card>
      )}
    </>
  );
}
