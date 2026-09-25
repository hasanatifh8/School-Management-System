import { getCurrentSchool } from "@/lib/school";
import { Card, PageHeader } from "@/components/ui";
import { createTeacher } from "../actions";
import { TeacherForm } from "../teacher-form";

export default async function NewTeacherPage() {
  await getCurrentSchool(); // admins only
  return (
    <>
      <PageHeader
        title="Add teacher"
        subtitle="A unique teacher ID is generated automatically when you save."
        breadcrumbs={[{ label: "Teachers", href: "/admin/teachers" }, { label: "Add teacher" }]}
      />
      <Card>
        <TeacherForm action={createTeacher} submitLabel="Add teacher" cancelHref="/admin/teachers" offerLogin />
      </Card>
    </>
  );
}
