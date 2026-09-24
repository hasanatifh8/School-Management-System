import { Card, PageHeader } from "@/components/ui";
import { getCurrentSchool } from "@/lib/school";
import { getClassesWithSections, getHouses } from "@/lib/queries";
import { createStudent } from "../actions";
import { StudentForm } from "../student-form";

export default async function NewStudentPage() {
  const school = await getCurrentSchool();
  const [classes, houses] = await Promise.all([getClassesWithSections(school.id), getHouses(school.id)]);
  return (
    <>
      <PageHeader
        title="New admission"
        subtitle="A unique student ID is generated automatically when you save."
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: "New admission" }]}
      />
      <Card>
        <StudentForm action={createStudent} classes={classes} houses={houses} submitLabel="Add student" cancelHref="/admin/students" />
      </Card>
    </>
  );
}
