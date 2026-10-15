import { Hash, Info } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Callout, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { saveStudentIdFormat } from "./actions";
import { StudentIdFormatFields } from "./format-fields";

/** How new student IDs look: <prefix>-<admission year>-<number>, e.g. STU-2026-0001. */
export default async function StudentIdPage() {
  const school = await getCurrentSchool();
  const year = new Date().getFullYear();
  const [format, counter] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: school.id }, select: { studentIdPrefix: true, studentIdDigits: true } }),
    db.counter.findUnique({ where: { schoolId_key: { schoolId: school.id, key: `student:${year}` } } }),
  ]);
  return (
    <>
      <PageHeader
        title="Student ID"
        subtitle="How new students' IDs look: a prefix, the admission year, then a number."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Student ID" }]}
      />
      <Card title="Student ID format" icon={Hash} className="max-w-2xl">
        <ActionForm action={saveStudentIdFormat} keepValues className="space-y-4">
          <StudentIdFormatFields prefix={format.studentIdPrefix} digits={format.studentIdDigits} year={year} next={(counter?.value ?? 0) + 1} />
          <Callout icon={Info}>
            The year is taken from the admission date on the Admission Form, so a student admitted in 2025 gets a 2025 ID. Students who already have an ID keep it.
          </Callout>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
