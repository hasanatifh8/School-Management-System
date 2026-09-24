import { Card, PageHeader } from "@/components/ui";
import { createSchool } from "../../../actions";
import { SchoolForm } from "../../school-form";

export default function NewSchoolPage() {
  return (
    <>
      <PageHeader
        title="Add school"
        subtitle="Each school has its own students, teachers, classes and sessions."
        breadcrumbs={[{ label: "Schools", href: "/power" }, { label: "Add school" }]}
      />
      <Card>
        <SchoolForm action={createSchool} submitLabel="Create school" cancelHref="/power" offerDemo />
      </Card>
    </>
  );
}
