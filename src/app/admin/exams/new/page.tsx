import { ExamDetailsForm } from "@/components/exams/exam-details-form";
import { Card, PageHeader } from "@/components/ui";
import { pickableSections } from "@/lib/exams";
import { getCurrentSchool } from "@/lib/school";
import { createExam } from "../actions";

export default async function NewExamPage() {
  const school = await getCurrentSchool();
  const classes = await pickableSections({ kind: "admin", schoolId: school.id, who: "" });
  return (
    <>
      <PageHeader
        title="New exam"
        subtitle="Name the exam and choose its classes. You'll build the date sheet next."
        breadcrumbs={[{ label: "Exams & tests", href: "/admin/exams" }, { label: "New exam" }]}
      />
      <Card className="max-w-4xl">
        <ExamDetailsForm action={createExam} classes={classes} kind="exam" submitLabel="Create and add timetable" cancelHref="/admin/exams" />
      </Card>
    </>
  );
}
