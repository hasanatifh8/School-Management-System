import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, FileBarChart, Lock, Printer, TableProperties, Users } from "lucide-react";
import { CardKeys } from "@/components/exams/card-keys";
import { ReportCard, ResultSheet, type SchoolHeader } from "@/components/exams/report-card";
import { ResultsStudentList } from "@/components/exams/results-student-list";
import { PrintButton } from "@/components/print-button";
import { Badge, buttonVariants, Card, StatCard } from "@/components/ui";
import { computeResults, type Sheet } from "@/lib/exam-marks";
import { formatMarks } from "@/lib/exams-shared";

export type { SchoolHeader };
export type ResultsMode = { view: "list" } | { view: "sheet" } | { view: "all-cards" } | { view: "card"; studentId: string };

const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/**
 * A section's results. Opens on the student list; each student opens their own
 * report card (with previous / next). The whole-class result sheet and the
 * print-all run of report cards are separate, deliberate views.
 */
export function ResultsView({
  sheet,
  school,
  mode,
  backHref,
  baseHref,
}: {
  sheet: Sheet;
  school: SchoolHeader;
  mode: ResultsMode;
  backHref: string;
  baseHref: string;
}) {
  const rows = computeResults(sheet);
  const byRoll = [...rows].sort(
    (a, b) => (a.student.rollNumber ?? 1e9) - (b.student.rollNumber ?? 1e9) || a.student.name.localeCompare(b.student.name),
  );
  const cardHref = (id: string) => `${baseHref}?student=${id}`;
  const printPortrait = `@page { size: A4 portrait; margin: 10mm; }`;
  const pageStyle = (page: string) => <style>{`${page} @media print { html, body { background: #fff !important; } }`}</style>;

  /* ── One report card, with previous / next ── */
  if (mode.view === "card") {
    const i = byRoll.findIndex((r) => r.student.id === mode.studentId);
    if (i >= 0) {
      const row = byRoll[i];
      const prev = byRoll[i - 1];
      const next = byRoll[i + 1];
      const navBtn = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-2 shadow-card transition hover:bg-surface-2";
      return (
        <div className="space-y-4">
          {pageStyle(printPortrait)}
          <CardKeys prev={prev ? cardHref(prev.student.id) : null} next={next ? cardHref(next.student.id) : null} list={baseHref} />
          <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/95 px-4 py-3 backdrop-blur print:hidden sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <Link href={baseHref} className={buttonVariants.ghost}>
              <ArrowLeft className="h-4 w-4" />
              All students
            </Link>
            <span className="text-sm text-muted">
              Student <b className="tabular-nums text-fg">{i + 1}</b> of <span className="tabular-nums">{byRoll.length}</span>
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {prev ? (
                <Link href={cardHref(prev.student.id)} scroll={false} className={navBtn} title="Previous (←)">
                  <ChevronLeft className="h-4 w-4" />
                  <span className="max-w-32 truncate">{prev.student.name}</span>
                </Link>
              ) : (
                <span className={`${navBtn} pointer-events-none opacity-40`}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}
              {next ? (
                <Link href={cardHref(next.student.id)} scroll={false} className={navBtn} title="Next (→)">
                  <span className="max-w-32 truncate">{next.student.name}</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className={`${navBtn} pointer-events-none opacity-40`}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
              <PrintButton label="Print this card" />
            </div>
          </div>
          <p className="text-center text-xs text-subtle print:hidden">Tip: use ← and → to move between students, Esc to go back to the list.</p>
          <div className="mx-auto max-w-[210mm] print:max-w-none">
            <ReportCard sheet={sheet} school={school} row={row} total={rows.length} />
          </div>
        </div>
      );
    }
  }

  /* ── Every report card, for batch printing ── */
  if (mode.view === "all-cards") {
    return (
      <div className="space-y-6">
        {pageStyle(printPortrait)}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-fg ring-1 ring-inset ring-warning-line print:hidden">
          <Printer className="h-4 w-4" />
          <span className="flex-1">
            All {byRoll.length} report cards in roll-number order, one per A4 page. Use this only to print the whole class.
          </span>
          <Link href={baseHref} className={buttonVariants.ghost}>
            Back to students
          </Link>
          <PrintButton label={`Print ${byRoll.length} cards`} />
        </div>
        <div className="mx-auto max-w-[210mm] space-y-6 print:max-w-none print:space-y-0">
          {byRoll.map((row, i) => (
            <ReportCard key={row.student.id} sheet={sheet} school={school} row={row} total={rows.length} className={i > 0 ? "print:break-before-page" : ""} />
          ))}
        </div>
      </div>
    );
  }

  /* ── List and result sheet share a header with tabs ── */
  const complete = rows.filter((r) => r.complete && r.max);
  const passed = rows.filter((r) => r.result === "Pass").length;
  const failed = rows.filter((r) => r.result === "Fail").length;
  const avg = complete.length ? complete.reduce((n, r) => n + r.percent, 0) / complete.length : null;
  const top = complete.length ? Math.max(...complete.map((r) => r.percent)) : null;
  const isSheet = mode.view === "sheet";
  const tab = (active: boolean) =>
    `inline-flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition ${active ? "border-accent text-accent-text" : "border-transparent text-muted hover:text-fg"}`;

  return (
    <div className="space-y-6">
      {pageStyle(`@page { size: A4 ${sheet.papers.length > 5 ? "landscape" : "portrait"}; margin: 10mm; }`)}

      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-accent-text">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to marks
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Results · {sheet.section.label}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              {sheet.exam.name} · Session {sheet.exam.session}
              {sheet.published ? (
                <Badge tone="green">
                  <Lock className="h-3 w-3" />
                  Published {stamp.format(new Date(sheet.published.at))}
                </Badge>
              ) : (
                <Badge tone="amber" dot>
                  Preview: not published yet
                </Badge>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSheet ? (
              <PrintButton label="Print result sheet" />
            ) : (
              <Link href={`${baseHref}?view=all-cards`} className={buttonVariants.secondary}>
                <Printer className="h-4 w-4" />
                Print all report cards
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard icon={Users} tone="indigo" label="Students" value={rows.length} />
          <StatCard icon={FileBarChart} tone="emerald" label="Passed" value={passed} />
          <StatCard icon={FileBarChart} tone="rose" label="Failed" value={failed} />
          <StatCard icon={TableProperties} tone="sky" label="Class average" value={avg == null ? "—" : `${avg.toFixed(1)}%`} />
          <StatCard icon={FileBarChart} tone="amber" label="Highest" value={top == null ? "—" : `${formatMarks(top)}%`} />
        </div>

        <nav className="flex gap-6 border-b border-line">
          <Link href={baseHref} className={tab(!isSheet)}>
            <Users className="h-4 w-4" />
            Students & report cards
          </Link>
          <Link href={`${baseHref}?view=sheet`} className={tab(isSheet)}>
            <TableProperties className="h-4 w-4" />
            Result sheet
          </Link>
        </nav>
      </div>

      {isSheet ? (
        <ResultSheet sheet={sheet} school={school} rows={byRoll} />
      ) : (
        <Card padded={false}>
          <ResultsStudentList
            cardHref={`${baseHref}?student=`}
            students={rows.map((r) => ({
              id: r.student.id,
              name: r.student.name,
              rollNumber: r.student.rollNumber,
              studentCode: r.student.studentCode,
              photoUrl: r.student.photoId ? `/api/photos/${r.student.photoId}` : null,
              obtained: formatMarks(r.obtained),
              max: r.max,
              percent: r.complete && r.max ? r.percent : null,
              grade: r.complete ? r.grade : "—",
              rank: r.rank,
              result: r.result,
              failed: r.failed,
            }))}
          />
        </Card>
      )}
    </div>
  );
}
