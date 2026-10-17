import Link from "next/link";
import { Upload } from "lucide-react";
import { DialogButton } from "@/components/dialog-button";
import { MaterialForm } from "@/components/materials/material-form";
import { MaterialList, readMaterialFilters } from "@/components/materials/material-list";
import { Card, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { listMaterials, materialTargets } from "@/lib/materials";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { createMaterial, deleteMaterial } from "./actions";

/** Study material for every class this session: notes, assignments, test papers and syllabus (?class=). */
export default async function MaterialsPage({ searchParams }: PageProps<"/admin/materials">) {
  const sp = await searchParams;
  const school = await getCurrentSchool();
  const session = await getCurrentSession(school.id);
  const classes = await db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  const classId = classes.find((c) => c.id === sp.class)?.id ?? null;
  const [rows, targets, counts] = await Promise.all([
    listMaterials({ schoolId: school.id, sessionId: session.id, ...(classId && { classId }) }),
    materialTargets({ kind: "admin", schoolId: school.id, who: "" }),
    db.studyMaterial.groupBy({ by: ["classId"], where: { schoolId: school.id, sessionId: session.id }, _count: true }),
  ]);
  const byClass = new Map(counts.map((c) => [c.classId, c._count]));
  const base = classId ? `/admin/materials?class=${classId}` : "/admin/materials";

  return (
    <>
      <PageHeader
        title="Study material"
        subtitle={`Notes, assignments, test papers and syllabus for each class, session ${session.name}. Students see their class's in the student portal.`}
        action={
          <DialogButton label="Post material" icon={<Upload className="h-4 w-4" />} variant="primary" title="Post study material" description="Students of the chosen class (or section) see it in their portal." drawer>
            <MaterialForm action={createMaterial} targets={targets} today={todayISO()} />
          </DialogButton>
        }
      />
      <nav aria-label="Classes" className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/admin/materials" className={`rounded-full px-3 py-1.5 text-sm font-medium ${!classId ? "bg-fg text-canvas" : "bg-surface text-fg-2 ring-1 ring-line hover:bg-surface-2"}`}>
          All classes
        </Link>
        {classes.map((c) => (
          <Link key={c.id} href={`/admin/materials?class=${c.id}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${classId === c.id ? "bg-accent text-white" : "bg-surface text-fg-2 ring-1 ring-line hover:bg-surface-2"}`}>
            {c.name} <span className="tabular-nums opacity-70">{byClass.get(c.id) ?? 0}</span>
          </Link>
        ))}
      </nav>
      <Card padded={false}>
        <MaterialList rows={rows} base={base} filters={readMaterialFilters(sp)} remove={(m) => deleteMaterial.bind(null, m.id)} />
      </Card>
    </>
  );
}
