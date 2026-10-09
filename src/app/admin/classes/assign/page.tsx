import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { saveTeacherCell } from "../actions";
import { AssignGrid, type GridClass } from "./assign-grid";

/** Class teachers and subject teachers for the whole school on one screen. */
export default async function AssignTeachersPage() {
  const school = await getCurrentSchool();
  const [classes, teachers] = await Promise.all([
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } },
        sections: { orderBy: { name: "asc" }, include: { subjectAssignments: { select: { subjectId: true, teacherId: true } } } },
      },
    }),
    db.teacher.findMany({
      where: { schoolId: school.id, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        employeeCode: true,
        canTeach: { select: { subjectId: true } },
        classTeacherOf: { select: { id: true, name: true, class: { select: { name: true } } } },
      },
    }),
  ]);
  const grid: GridClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    subjects: c.subjects.map((cs) => cs.subject),
    sections: c.sections.map((s) => ({ id: s.id, name: s.name, classTeacherId: s.classTeacherId, teachers: Object.fromEntries(s.subjectAssignments.map((a) => [a.subjectId, a.teacherId])) })),
  }));

  return (
    <>
      <PageHeader
        title="Assign teachers"
        subtitle="Class teachers and subject teachers for every section. A change saves as soon as you pick a teacher."
        breadcrumbs={[{ label: "Classes", href: "/admin/classes" }, { label: "Assign teachers" }]}
      />
      {teachers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-8 text-center text-sm text-muted">Add teachers first.</p>
      ) : (
        <AssignGrid classes={grid} teachers={teachers} save={saveTeacherCell} />
      )}
    </>
  );
}
