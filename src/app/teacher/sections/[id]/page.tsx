import { notFound, redirect } from "next/navigation";
import { BookOpen, Users } from "lucide-react";
import { Card, EmptyState, PageHeader, PersonCell, Table, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

/** Students of a section where this teacher teaches a subject (names and roll numbers only). */
export default async function SubjectSectionPage({ params, searchParams }: PageProps<"/teacher/sections/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireTeacher();
  if (ctx.classSection?.id === id) redirect("/teacher/class");
  const entry = ctx.subjectSections.find((s) => s.section.id === id);
  if (!entry) notFound();

  const where = { sectionId: id, status: "ACTIVE" as const };
  const total = await db.student.count({ where });
  const paging = paginate(query, total);
  const students = await db.student.findMany({
    where,
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }, { id: "asc" }],
    skip: paging.skip,
    take: paging.take,
    select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, rollNumber: true, photoId: true },
  });

  return (
    <>
      <PageHeader
        title={sectionLabel(entry.section)}
        subtitle={
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> You teach {entry.subjects.join(", ")} · {total} students
          </span>
        }
        breadcrumbs={[{ label: "Dashboard", href: "/teacher" }, { label: sectionLabel(entry.section) }]}
      />
      <Card padded={false}>
        {students.length === 0 ? (
          <EmptyState icon={Users} title="No students in this section yet" />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Roll</th>
                <th className={thClass}>Student</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {students.map((s) => (
                <tr key={s.id} className={trClass}>
                  <td className={`${tdClass} w-14 tabular-nums font-medium`}>{s.rollNumber ?? "—"}</td>
                  <td className={tdClass}>
                    <PersonCell name={fullName(s)} photoUrl={photoUrl(s.photoId)} sub={<span className="font-mono">{s.studentCode}</span>} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination paging={paging} noun="students" />
      </Card>
      <p className="mt-4 text-sm text-muted">Full student details are available to the class teacher of this section.</p>
    </>
  );
}
