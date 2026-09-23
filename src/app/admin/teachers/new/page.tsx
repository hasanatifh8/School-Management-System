import { Card, PageHeader } from "@/components/ui";
import { createTeacher } from "../actions";
import { TeacherForm } from "../teacher-form";

export default function NewTeacherPage() {
  return (
    <>
      <PageHeader
        title="Add teacher"
        subtitle="A unique teacher ID is generated automatically when you save."
        breadcrumbs={[{ label: "Teachers", href: "/admin/teachers" }, { label: "Add teacher" }]}
      />
      <Card>
        <TeacherForm action={createTeacher} submitLabel="Add teacher" cancelHref="/admin/teachers" />
      </Card>
    </>
  );
}
