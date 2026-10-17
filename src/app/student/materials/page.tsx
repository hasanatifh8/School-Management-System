import { MaterialList, readMaterialFilters } from "@/components/materials/material-list";
import { Card, PageHeader } from "@/components/ui";
import { listMaterials, studentMaterialWhere } from "@/lib/materials";
import { getCurrentSession } from "@/lib/sessions";
import { requireStudent } from "@/lib/student-auth";

/** The student's class's study material: notes, assignments, test papers and syllabus. */
export default async function StudentMaterialsPage({ searchParams }: PageProps<"/student/materials">) {
  const sp = await searchParams;
  const { school, section } = await requireStudent();
  const session = await getCurrentSession(school.id);
  const rows = await listMaterials(studentMaterialWhere(school.id, session.id, section));
  return (
    <>
      <PageHeader title="Study material" subtitle="Notes, assignments, test papers and the syllabus from your teachers." />
      <Card padded={false}>
        <MaterialList rows={rows} base="/student/materials" filters={readMaterialFilters(sp)} showClass={false} />
      </Card>
    </>
  );
}
