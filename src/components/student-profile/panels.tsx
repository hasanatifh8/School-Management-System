import Link from "next/link";
import { Bus, CalendarClock, ClipboardList, Download, FileBarChart, Megaphone, Paperclip, Phone, Printer, Ticket, UserRound } from "lucide-react";
import { AdmitCardPages } from "@/components/exams/admit-card";
import { PdfDownloadButton } from "@/components/pdf-download";
import { ReportCard } from "@/components/exams/report-card";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { Badge, Card, EmptyState, buttonVariants } from "@/components/ui";
import { loadAdmitCards } from "@/lib/admit-cards";
import { formatISO, shortDate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { computeResults, loadSheet } from "@/lib/exam-marks";
import { loadExam, schoolHeader, type ExamActor } from "@/lib/exams";
import { dateSpan, formatExamDate, timeRange } from "@/lib/exams-shared";
import { noticeStatus } from "@/lib/notices-shared";
import type { StudentExam, studentNotices } from "@/lib/student-profile";
import { getPeriods, loadSectionCells } from "@/lib/timetable";

const STATUS = {
  upcoming: { label: "Upcoming", tone: "sky" },
  ongoing: { label: "On now", tone: "amber" },
  completed: { label: "Completed", tone: "slate" },
  unscheduled: { label: "Dates not set", tone: "slate" },
} as const;

/** Exams and tests, scheduled and past, with the student's own date sheet. */
export function ExamsPanel({ exams, reportHref }: { exams: StudentExam[]; reportHref: (e: StudentExam) => string }) {
  if (!exams.length) return <EmptyState icon={ClipboardList} title="No exams yet" description="Exams and class tests for this student's class show here." />;
  const upcoming = exams.filter((e) => e.status === "upcoming" || e.status === "ongoing" || e.status === "unscheduled");
  const past = exams.filter((e) => e.status === "completed");
  const list = (title: string, items: StudentExam[]) =>
    items.length > 0 && (
      <Card title={title} icon={ClipboardList} padded={false}>
        <ul className="divide-y divide-line">
          {items.map((e) => (
            <li key={e.id} className="px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-fg">{e.name}</p>
                <Badge tone={e.kind === "EXAM" ? "indigo" : "sky"}>{e.kind === "EXAM" ? "Exam" : "Class test"}</Badge>
                <Badge tone={STATUS[e.status].tone} dot>
                  {STATUS[e.status].label}
                </Badge>
                {e.resultPublishedAt && (
                  <Link href={reportHref(e)} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                    <FileBarChart className="h-4 w-4" /> Report card
                  </Link>
                )}
              </div>
              <p className="text-xs text-muted">
                {e.sectionLabel} · Session {e.session} · {dateSpan(e.papers.map((p) => p.date))}
              </p>
              {e.papers.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-accent-text">
                    {e.papers.length} paper{e.papers.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {e.papers.map((p) => (
                      <li key={p.id} className="flex gap-2">
                        <span className="w-24 shrink-0 tabular-nums text-muted">{formatExamDate(p.date).replace(/ \d{4}$/, "")}</span>
                        <span className="min-w-0 truncate text-fg">
                          {p.name}
                          <span className="text-xs text-muted"> · {timeRange(p.startTime, p.endTime)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Card>
    );
  return (
    <div className="space-y-6">
      {list("Scheduled", upcoming)}
      {list("Past exams", past)}
    </div>
  );
}

/** The chosen exam's report card (published results only), with print and download. */
export async function ReportCardPanel({
  actor,
  studentId,
  exams,
  selected,
  tabHref,
  cardHref,
}: {
  actor: ExamActor;
  studentId: string;
  exams: StudentExam[];
  selected: string | undefined;
  tabHref: (examId: string) => string;
  /** The card in Marks & results, where it prints at A4 (null in portals without it). */
  cardHref: ((e: StudentExam) => string) | null;
}) {
  const published = exams.filter((e) => e.resultPublishedAt);
  if (!published.length) return <EmptyState icon={FileBarChart} title="No published results yet" description="Report cards appear here once a class's results are published." />;
  const current = published.find((e) => e.id === selected) ?? published[0];
  const exam = await loadExam(actor.schoolId, current.id);
  const sheet = exam && (await loadSheet(actor, exam, current.sectionId));
  const row = sheet ? computeResults(sheet).find((r) => r.student.id === studentId) : undefined;
  return (
    <div className="space-y-4">
      <ExamPicker exams={published} current={current.id} href={tabHref} />
      {sheet && row ? (
        <>
          <div className="flex flex-wrap justify-end gap-2">
            {cardHref ? (
              <>
                <Link href={`${cardHref(current)}&do=pdf`} className={buttonVariants.secondary}>
                  <Download className="h-4 w-4" /> Download PDF
                </Link>
                <Link href={`${cardHref(current)}&do=print`} className={buttonVariants.primary}>
                  <Printer className="h-4 w-4" /> Print
                </Link>
              </>
            ) : (
              <PdfDownloadButton root="profile-report-card" fileName={`Report card - ${row.student.name} - ${current.name}`} />
            )}
          </div>
          <div data-pdf-root="profile-report-card" className="mx-auto max-w-[210mm] overflow-x-auto">
            <ReportCard sheet={sheet} school={await schoolHeader(actor.schoolId)} row={row} total={sheet.students.length} />
          </div>
        </>
      ) : (
        <Card>
          <EmptyState compact icon={FileBarChart} title="Report card not available" description="The student has since moved class, so this result sheet doesn't include them." />
        </Card>
      )}
    </div>
  );
}

/** The class timetable, read only. */
export async function TimetablePanel({ schoolId, sectionId }: { schoolId: string; sectionId: string | null }) {
  if (!sectionId) return <EmptyState icon={CalendarClock} title="No class assigned" />;
  const [periods, cells, school] = await Promise.all([
    getPeriods(schoolId),
    loadSectionCells(sectionId),
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timetableDays: true } }),
  ]);
  if (!periods.some((p) => !p.isBreak)) return <EmptyState icon={CalendarClock} title="No timetable yet" description="The school hasn't set up its periods." />;
  const today = new Date(`${todayISO()}T00:00:00Z`).getUTCDay() || 7;
  return (
    <Card title="Class timetable" icon={CalendarClock} description="Subjects and teachers for each period. Today is highlighted.">
      <TimetableGrid days={[...school.timetableDays].sort()} periods={periods} cells={cells} today={today} />
    </Card>
  );
}

/** Notices sent to this student's family. */
export function NoticesPanel({ notices, noticeHref }: { notices: Awaited<ReturnType<typeof studentNotices>>; noticeHref: ((id: string) => string) | null }) {
  if (!notices.length) return <EmptyState icon={Megaphone} title="No notices yet" description="Notices sent to this student's class or family show here." />;
  const now = new Date();
  const today = todayISO();
  return (
    <Card title="Notices" icon={Megaphone} description={`${notices.length} sent to this student's family`} padded={false}>
      <ul className="divide-y divide-line">
        {notices.map((n) => {
          const active = noticeStatus(n, now, today) === "ACTIVE";
          return (
            <li key={n.id} className="px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                {noticeHref ? (
                  <Link href={noticeHref(n.id)} className="font-medium text-fg hover:text-accent-text">
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium text-fg">{n.title}</p>
                )}
                {!active && <Badge>Expired</Badge>}
                <span className="ml-auto text-xs text-muted">{formatISO(n.publishAt.toISOString().slice(0, 10), shortDate)}</span>
              </div>
              <p className="text-xs text-muted">{n.audience}</p>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-fg-2">{n.body}</p>
              {n.attachment && active && (
                <a href={`/n/${n.attachment.token}`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline">
                  <Paperclip className="h-4 w-4" />
                  {n.attachment.fileName}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The student's admit card for a school exam of their current class. */
export async function AdmitCardPanel({
  schoolId,
  studentId,
  exams,
  selected,
  tabHref,
  cardHref,
}: {
  schoolId: string;
  studentId: string;
  exams: StudentExam[];
  selected: string | undefined;
  tabHref: (examId: string) => string;
  cardHref: ((e: StudentExam) => string) | null;
}) {
  const available = exams.filter((e) => e.kind === "EXAM" && e.papers.length > 0 && e.status !== "completed");
  const list = available.length ? available : exams.filter((e) => e.kind === "EXAM" && e.papers.length > 0);
  if (!list.length) return <EmptyState icon={Ticket} title="No admit cards yet" description="Admit cards appear for school exams once their date sheet is made." />;
  const current = list.find((e) => e.id === selected) ?? list[0];
  const exam = await loadExam(schoolId, current.id);
  const data = exam && (await loadAdmitCards(exam, current.sectionId));
  const student = data?.students.find((s) => s.id === studentId);
  return (
    <div className="space-y-4">
      <ExamPicker exams={list} current={current.id} href={tabHref} />
      {!current.published && (
        <p className="rounded-xl bg-warning-soft px-4 py-2 text-sm text-fg ring-1 ring-inset ring-warning-line">This exam is still a draft, so its date sheet may change.</p>
      )}
      {data && student ? (
        <>
          <div className="flex flex-wrap justify-end gap-2">
            {cardHref ? (
              <>
                <Link href={`${cardHref(current)}&do=pdf`} className={buttonVariants.secondary}>
                  <Download className="h-4 w-4" /> Download PDF
                </Link>
                <Link href={`${cardHref(current)}&do=print`} className={buttonVariants.primary}>
                  <Printer className="h-4 w-4" /> Print
                </Link>
              </>
            ) : (
              <PdfDownloadButton root="profile-admit-card" fileName={`Admit card - ${student.name} - ${current.name}`} />
            )}
          </div>
          <div data-pdf-root="profile-admit-card" className="overflow-x-auto">
            <AdmitCardPages data={data} students={[student]} />
          </div>
        </>
      ) : (
        <Card>
          <EmptyState compact icon={Ticket} title="Admit card not available" description="The student isn't in this exam's class any more." />
        </Card>
      )}
    </div>
  );
}

function ExamPicker({ exams, current, href }: { exams: StudentExam[]; current: string; href: (id: string) => string }) {
  if (exams.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose an exam">
      {exams.map((e) => (
        <Link
          key={e.id}
          href={href(e.id)}
          scroll={false}
          aria-current={e.id === current ? "true" : undefined}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${e.id === current ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
        >
          {e.name}
        </Link>
      ))}
    </div>
  );
}

type Route = {
  id: string;
  routeNumber: string;
  name: string | null;
  vehicleNumber: string;
  vehicleType: string | null;
  driverName: string | null;
  driverPhone: string | null;
  attendantName: string | null;
  attendantPhone: string | null;
  stops: string[];
};

/** Route, vehicle, driver and stop; `assign` is the admin's form to change it. */
export function TransportPanel({ route, stop, assign, routeHref }: { route: Route | null; stop: string | null; assign?: React.ReactNode; routeHref?: string }) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card title="School transport" icon={Bus} className="xl:col-span-2">
        {!route ? (
          <EmptyState compact icon={Bus} title="Doesn't use school transport" description={assign ? "Choose a route on the right to add the student." : undefined} />
        ) : (
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-eyebrow uppercase text-muted">Route</dt>
              <dd className="mt-0.5 text-lg font-semibold text-fg">
                {routeHref ? (
                  <Link href={routeHref} className="hover:text-accent-text">
                    {route.routeNumber}
                  </Link>
                ) : (
                  route.routeNumber
                )}
                {route.name && <span className="block text-sm font-normal text-muted">{route.name}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow uppercase text-muted">Pick-up / drop stop</dt>
              <dd className="mt-0.5 text-lg font-semibold text-fg">{stop ?? <span className="text-base font-normal text-warning">Not chosen</span>}</dd>
            </div>
            <div>
              <dt className="text-eyebrow uppercase text-muted">Vehicle</dt>
              <dd className="mt-0.5 font-mono text-fg">
                {route.vehicleNumber}
                {route.vehicleType && <span className="block font-sans text-sm text-muted">{route.vehicleType}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow uppercase text-muted">Driver</dt>
              <dd className="mt-0.5 text-fg">
                <span className="flex items-center gap-1.5">
                  <UserRound className="h-4 w-4 text-subtle" />
                  {route.driverName ?? "—"}
                </span>
                {route.driverPhone && (
                  <a href={`tel:${route.driverPhone}`} className="mt-0.5 flex items-center gap-1.5 font-medium text-accent-text hover:underline">
                    <Phone className="h-4 w-4" />
                    {route.driverPhone}
                  </a>
                )}
              </dd>
            </div>
            {(route.attendantName || route.attendantPhone) && (
              <div>
                <dt className="text-eyebrow uppercase text-muted">Attendant</dt>
                <dd className="mt-0.5 text-fg">
                  {route.attendantName ?? "—"}
                  {route.attendantPhone && (
                    <a href={`tel:${route.attendantPhone}`} className="block font-medium text-accent-text hover:underline">
                      {route.attendantPhone}
                    </a>
                  )}
                </dd>
              </div>
            )}
            {route.stops.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-eyebrow uppercase text-muted">Stops</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {route.stops.map((s) => (
                    <Badge key={s} tone={s === stop ? "indigo" : "slate"}>
                      {s}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Card>
      {assign}
    </div>
  );
}

