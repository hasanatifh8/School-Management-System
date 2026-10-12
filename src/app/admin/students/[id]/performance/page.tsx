import { notFound } from "next/navigation";
import { ChartLine, UserRound } from "lucide-react";
import { AutoRun, PdfDownloadButton } from "@/components/pdf-download";
import { PerformanceReportView } from "@/components/performance/report";
import { PrintButton } from "@/components/print-button";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { schoolHeader } from "@/lib/exams";
import { performanceReport } from "@/lib/performance";
import { fullName } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

/**
 * The Performance Analytics Report: a two-page A4 companion to the report card
 * that shows how a student is doing across the session's class tests and
 * exams, against their class, and alongside their attendance, with strengths,
 * focus areas and suggested actions. Prints, or downloads as a PDF.
 */
export default async function PerformanceReportPage({ params, searchParams }: PageProps<"/admin/students/[id]/performance">) {
  const { id } = await params;
  const sp = await searchParams;
  const school = await getCurrentSchool();
  const [report, header] = await Promise.all([performanceReport(school.id, id), schoolHeader(school.id)]);
  if (!report) notFound();
  const { student, session } = report;
  const name = fullName(student);
  const fileName = `${student.rollNumber ?? student.studentCode} ${name} - Performance ${session.name}`;
  const toolbar = (
    <div className="print:hidden">
      <PageHeader
        title="Performance report"
        subtitle={`${name} · Session ${session.name}`}
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: name, href: `/admin/students/${student.id}` }, { label: "Performance report" }]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {report.assessments.length > 0 && (
          <>
            <PrintButton label="Print" />
            <PdfDownloadButton root="performance" fileName={fileName} />
          </>
        )}
        <ButtonLink href={`/admin/students/${student.id}?tab=results`} variant="secondary" icon={UserRound}>
          Report card
        </ButtonLink>
      </div>
    </div>
  );

  if (!report.assessments.length) {
    return (
      <>
        {toolbar}
        <Card>
          <EmptyState
            icon={ChartLine}
            title="No published results yet"
            description={`The performance report is built from this session's published class tests and exams. Publish ${student.firstName}'s class results in Marks & results, then open this again.`}
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}
      <AutoRun action={typeof sp.do === "string" ? sp.do : undefined} root="performance" fileName={fileName} />
      <style>{`@page { size: A4 portrait; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <PerformanceReportView report={report} school={header} />
    </div>
  );
}
