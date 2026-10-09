import { notFound } from "next/navigation";
import { School } from "lucide-react";
import { IdCardSteps } from "@/components/id-card/steps";
import { StudentPicker } from "@/components/id-card/student-picker";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MAX_CARDS_PER_BATCH, loadIdCardRoster } from "@/lib/id-cards";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { ClassSwitcher } from "@/components/teaching/class-switcher";

/** Pick students of the teacher's own class to make ID cards for. */
export default async function TeacherIdCardsPage() {
  const ctx = await requireTeacher();
  if (!ctx.classSection) notFound();
  const students = await loadIdCardRoster(ctx.school.id, ctx.classSection.id);
  return (
    <>
      <ClassSwitcher sections={ctx.classSections} current={ctx.classSection?.id} here="/teacher/id-cards" />
      <PageHeader title="ID cards" subtitle={`${sectionLabel(ctx.classSection)} · ${students.length} students`} />
      <IdCardSteps steps={[{ label: "Pick students", href: "/teacher/id-cards" }, { label: "Download or print" }]} current={0} />
      {students.length ? (
        <StudentPicker students={students} generatePath="/teacher/id-cards/generate" profilePath="/teacher/students" max={MAX_CARDS_PER_BATCH} />
      ) : (
        <Card>
          <EmptyState icon={School} title="No students in your class yet" />
        </Card>
      )}
    </>
  );
}
