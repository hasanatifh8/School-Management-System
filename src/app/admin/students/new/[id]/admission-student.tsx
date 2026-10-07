import { notFound } from "next/navigation";
import { Avatar, Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

/** The student being admitted, for steps 2 and 3. */
export async function loadAdmission(id: string) {
  const school = await getCurrentSchool();
  const student = await db.student.findFirst({
    where: { id, schoolId: school.id, status: "ACTIVE" },
    include: { section: { include: { class: true } } },
  });
  if (!student) notFound();
  return { school, student };
}

/** Who is being admitted: photo, name, ID and class. */
export function AdmissionStudent({ student }: { student: Awaited<ReturnType<typeof loadAdmission>>["student"] }) {
  return (
    <div className="flex items-center gap-3 border-b border-line pb-4">
      <Avatar name={fullName(student)} src={photoUrl(student.photoId)} size="md" />
      <div className="min-w-0">
        <p className="font-semibold text-fg">{fullName(student)}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="font-mono">{student.studentCode}</span>
          {student.section ? <Badge tone="indigo">{sectionLabel(student.section)}</Badge> : <Badge tone="amber">No class</Badge>}
        </p>
      </div>
    </div>
  );
}
