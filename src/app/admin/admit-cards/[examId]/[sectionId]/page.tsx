import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, Printer, Ticket } from "lucide-react";
import { AdmitCardPages } from "@/components/exams/admit-card";
import { AutoRun, PdfDownloadButton } from "@/components/pdf-download";
import { PrintButton } from "@/components/print-button";
import { Avatar, Card, EmptyState, PageHeader, PagedList, buttonVariants } from "@/components/ui";
import { loadAdmitCards } from "@/lib/admit-cards";
import { loadExam } from "@/lib/exams";
import { getCurrentSchool } from "@/lib/school";

const printPage = <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>;
const iconBtn = "rounded-lg p-2 text-subtle transition hover:bg-surface-3 hover:text-fg-2";

/**
 * Admit cards, step 3: the section's students. ?student= previews one card
 * (&do=print|pdf prints or downloads it at once); ?view=all is every card for bulk printing.
 */
export default async function AdmitCardSectionPage({ params, searchParams }: PageProps<"/admin/admit-cards/[examId]/[sectionId]">) {
  const { examId, sectionId } = await params;
  const query = await searchParams;
  const school = await getCurrentSchool();
  const exam = await loadExam(school.id, examId);
  if (!exam) notFound();
  const data = await loadAdmitCards(exam, sectionId);
  if (!data) notFound();
  const base = `/admin/admit-cards/${exam.id}/${sectionId}`;
  const file = (who: string) => `Admit card - ${who} - ${data.exam.name} - ${data.section.label}`.replace(/[\\/:*?"<>|]+/g, " ");

  // One student's card.
  const one = typeof query.student === "string" ? data.students.find((s) => s.id === query.student) : undefined;
  if (one) {
    return (
      <div className="space-y-4">
        {printPage}
        <AutoRun action={typeof query.do === "string" ? query.do : undefined} root="admit-card" fileName={file(one.name)} />
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link replace href={base} className={buttonVariants.ghost}>
            <ArrowLeft className="h-4 w-4" />
            All students
          </Link>
          <span className="text-sm text-muted">
            {one.name} · {data.section.label}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <PdfDownloadButton root="admit-card" fileName={file(one.name)} />
            <PrintButton label="Print card" />
          </div>
        </div>
        <div data-pdf-root="admit-card">
          <AdmitCardPages data={data} students={[one]} />
        </div>
      </div>
    );
  }

  // Every card, for bulk printing.
  if (query.view === "all" && data.students.length) {
    return (
      <div className="space-y-6">
        {printPage}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-fg ring-1 ring-inset ring-warning-line print:hidden">
          <Printer className="h-4 w-4" />
          <span className="flex-1">
            All {data.students.length} admit cards for {data.section.label}, two per A4 page, in roll-number order.
          </span>
          <Link replace href={base} className={buttonVariants.ghost}>
            Back to students
          </Link>
          <PdfDownloadButton root="admit-cards" fileName={file(`all ${data.students.length}`)} label="Download PDF" />
          <PrintButton label={`Print ${data.students.length} cards`} />
        </div>
        <div data-pdf-root="admit-cards">
          <AdmitCardPages data={data} students={data.students} />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Admit cards · ${data.section.label}`}
        subtitle={`${data.exam.name} · ${data.students.length} students · ${data.papers} paper${data.papers === 1 ? "" : "s"}`}
        breadcrumbs={[
          { label: "Admit cards", href: "/admin/admit-cards" },
          { label: data.exam.name, href: `/admin/admit-cards/${exam.id}` },
          { label: data.section.label },
        ]}
        action={
          data.students.length > 0 && (
            <Link replace href={`${base}?view=all`} className={buttonVariants.primary}>
              <Printer className="h-4 w-4" />
              Print / download all
            </Link>
          )
        }
      />
      <Card padded={false}>
        {data.students.length === 0 ? (
          <EmptyState icon={Ticket} title="No students in this section" />
        ) : (
          <PagedList pageSize={20} noun="students">
            {data.students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-6">
                <span className="w-8 text-right text-sm tabular-nums text-subtle">{s.rollNumber ?? "—"}</span>
                <Avatar name={s.name} src={s.photoUrl} />
                <Link replace href={`${base}?student=${s.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg hover:text-accent-text">{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    <span className="font-mono">{s.studentCode}</span>
                    {s.guardian.name && ` · ${s.guardian.name}`} · {s.papers.length} paper{s.papers.length === 1 ? "" : "s"}
                  </p>
                </Link>
                <Link replace href={`${base}?student=${s.id}`} className={`${buttonVariants.secondary} !px-3 !py-1.5 text-xs`}>
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </Link>
                <Link replace href={`${base}?student=${s.id}&do=print`} title="Print" aria-label={`Print ${s.name}'s admit card`} className={iconBtn}>
                  <Printer className="h-4 w-4" />
                </Link>
                <Link replace href={`${base}?student=${s.id}&do=pdf`} title="Download PDF" aria-label={`Download ${s.name}'s admit card`} className={iconBtn}>
                  <Download className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </PagedList>
        )}
      </Card>
    </>
  );
}
