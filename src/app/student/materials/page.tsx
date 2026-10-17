import { BookOpenText } from "lucide-react";
import { readMaterialFilters } from "@/components/materials/material-list";
import { StudentMaterialGrid } from "@/components/student-portal/material-grid";
import { StudentBanner } from "@/components/student-portal/ui";
import { listMaterials, studentMaterialWhere } from "@/lib/materials";
import { getCurrentSession } from "@/lib/sessions";
import { requireStudent } from "@/lib/student-auth";

/** The student's class's study material: notes, assignments, test papers and syllabus. */
export default async function StudentMaterialsPage({ searchParams }: PageProps<"/student/materials">) {
  const sp = await searchParams;
  const { school, section } = await requireStudent();
  const session = await getCurrentSession(school.id);
  const rows = await listMaterials(studentMaterialWhere(school.id, session.id, section));
  const assignments = rows.filter((r) => r.kind === "ASSIGNMENT").length;
  return (
    <>
      <StudentBanner
        icon={BookOpenText}
        tone="emerald"
        title="Study material"
        subtitle={`Notes, assignments, test papers and the syllabus from your teachers${rows.length ? ` · ${rows.length} item${rows.length === 1 ? "" : "s"}${assignments ? `, ${assignments} assignment${assignments === 1 ? "" : "s"}` : ""}` : ""}.`}
      />
      <StudentMaterialGrid rows={rows} filters={readMaterialFilters(sp)} page={Number(typeof sp.page === "string" ? sp.page : 1) || 1} />
    </>
  );
}
