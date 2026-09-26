import { ExamDetailsForm } from "@/components/exams/exam-details-form";
import { Card, PageHeader } from "@/components/ui";
import { pickableSections, teacherActor } from "@/lib/exams";
import { requireTeacher } from "@/lib/teacher-auth";
import { createTest } from "../actions";

export default async function NewTestPage() {
  const ctx = await requireTeacher();
  const classes = await pickableSections(teacherActor(ctx));
  return (
    <>
      <PageHeader
        title="New test"
        subtitle="Name the test and choose the sections. You'll add dates and subjects next."
        breadcrumbs={[{ label: "Tests & exams", href: "/teacher/tests" }, { label: "New test" }]}
      />
      <Card className="max-w-4xl">
        <ExamDetailsForm action={createTest} classes={classes} kind="test" submitLabel="Create and add timetable" cancelHref="/teacher/tests" />
      </Card>
    </>
  );
}
