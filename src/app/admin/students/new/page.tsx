import { ArrowRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentSchool } from "@/lib/school";
import { getClassesWithSections, getHouses } from "@/lib/queries";
import { createStudent } from "../actions";
import { StudentForm } from "../student-form";
import { AdmissionSteps } from "./admission-steps";

export default async function NewStudentPage() {
  const school = await getCurrentSchool();
  const [classes, houses] = await Promise.all([getClassesWithSections(school.id), getHouses(school.id)]);
  return (
    <>
      <PageHeader
        title="New admission"
        subtitle="A unique student ID is generated when you save. Transport and optional fees come next."
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: "New admission" }]}
      />
      <AdmissionSteps current={1} />
      <Card>
        <StudentForm
          action={createStudent}
          classes={classes}
          houses={houses}
          submitLabel="Save & next"
          submitIcon={<ArrowRight className="h-4 w-4" />}
          cancelHref="/admin/students"
        />
      </Card>
    </>
  );
}
