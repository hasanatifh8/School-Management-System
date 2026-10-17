import { ExamsPanel, ReportCardPanel } from "@/components/student-profile/panels";
import { Trophy } from "lucide-react";
import { StudentBanner } from "@/components/student-portal/ui";
import { StatusTab, tabBarClass } from "@/components/ui";
import { loadPortalStudent, portalExams } from "../student-data";

/** The student's exams (date sheets) and published report cards (?tab=exams, ?exam=). */
export default async function StudentResultsPage({ searchParams }: PageProps<"/student/results">) {
  const sp = await searchParams;
  const { full, school } = await loadPortalStudent();
  const exams = await portalExams(full);
  const tab = sp.tab === "exams" ? "exams" : "results";
  const selected = typeof sp.exam === "string" ? sp.exam : undefined;
  return (
    <>
      <StudentBanner icon={Trophy} tone="amber" title="My results" subtitle="Report cards once results are published, and the date sheets of your exams and tests." />
      <div className="mb-6 border-b border-line">
        <nav aria-label="Results" className={tabBarClass}>
          <StatusTab replace href="/student/results" active={tab === "results"} label="Report cards" count={exams.filter((e) => e.resultPublishedAt).length} />
          <StatusTab replace href="/student/results?tab=exams" active={tab === "exams"} label="Exams & date sheets" count={exams.length} />
        </nav>
      </div>
      {tab === "exams" ? (
        <ExamsPanel exams={exams} reportHref={(e) => `/student/results?exam=${e.id}`} />
      ) : (
        <ReportCardPanel
          // Only published results, and only this student's line of each sheet, are shown.
          actor={{ kind: "admin", schoolId: school.id, who: "" }}
          studentId={full.id}
          exams={exams}
          selected={selected}
          tabHref={(examId) => `/student/results?exam=${examId}`}
          cardHref={null}
        />
      )}
    </>
  );
}
