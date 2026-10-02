import { LeavePageContent } from "@/components/leave/leave-page";
import { teacherLeaveActor } from "@/lib/leave";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { decideStudentLeave, withdrawLeave } from "./actions";

/** A teacher's own leave, and (for a class teacher) their students' requests to decide. */
export default async function TeacherLeavePage({ searchParams }: PageProps<"/teacher/leave">) {
  const ctx = await requireTeacher();
  return (
    <LeavePageContent
      actor={teacherLeaveActor(ctx)}
      params={await searchParams}
      base="/teacher/leave"
      subtitle={
        ctx.classSection
          ? `Your leave, and leave for students of ${sectionLabel(ctx.classSection)}, which you approve.`
          : "Apply for leave and follow its status. The school admin approves it."
      }
      whoOptions={ctx.classSection ? [{ value: "mine", label: "My leave" }, { value: "student", label: "My students" }] : []}
      personHref={(r) => (r.applicant === "STUDENT" && r.person.href ? `/teacher${r.person.href}` : null)}
      decide={(id) => decideStudentLeave.bind(null, id)}
      withdraw={(id) => withdrawLeave.bind(null, id)}
    />
  );
}
