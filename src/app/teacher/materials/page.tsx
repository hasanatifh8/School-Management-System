import { Upload } from "lucide-react";
import { DialogButton } from "@/components/dialog-button";
import { MaterialForm } from "@/components/materials/material-form";
import { MaterialList, readMaterialFilters } from "@/components/materials/material-list";
import { Card, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { fullName } from "@/lib/queries";
import { listMaterials, materialTargets, teacherMaterialWhere } from "@/lib/materials";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";
import { postMaterial, removeMaterial } from "./actions";

/** Study material for the classes the teacher teaches: post notes, assignments and test papers. */
export default async function TeacherMaterialsPage({ searchParams }: PageProps<"/teacher/materials">) {
  const sp = await searchParams;
  const ctx = await requireTeacher();
  const session = await getCurrentSession(ctx.school.id);
  const [rows, targets] = await Promise.all([
    listMaterials(teacherMaterialWhere(ctx, session.id)),
    materialTargets({ kind: "teacher", schoolId: ctx.school.id, who: fullName(ctx.teacher), ctx }),
  ]);
  return (
    <>
      <PageHeader
        title="Study material"
        subtitle="Notes, assignments, test papers and syllabus for your classes. Students see them in their portal."
        action={
          targets.length > 0 && (
            <DialogButton label="Post material" icon={<Upload className="h-4 w-4" />} variant="primary" title="Post study material" description="For your class, or a section where you teach a subject." drawer>
              <MaterialForm action={postMaterial} targets={targets} today={todayISO()} />
            </DialogButton>
          )
        }
      />
      <Card padded={false}>
        <MaterialList rows={rows} base="/teacher/materials" filters={readMaterialFilters(sp)} remove={(m) => (m.teacherId === ctx.teacher.id ? removeMaterial.bind(null, m.id) : null)} />
      </Card>
    </>
  );
}
