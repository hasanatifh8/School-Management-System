import { notFound } from "next/navigation";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { BookOpen, Bus, CalendarClock, CalendarDays, CircleCheck, ClipboardList, Droplet, FileBarChart, FileCheck2, FileText, Hash, History, IdCard, LayoutGrid, Mail, Megaphone, Pencil, Phone, RotateCcw, Ticket, UserRound, UserRoundX, Wallet } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DeletePermanently } from "@/components/delete-permanently";
import { deletePermanently } from "../../permanent-delete-actions";
import { DocumentsPanel } from "../../documents/documents-panel";
import { AttendanceSummaryCard } from "@/components/attendance/attendance-summary";
import { Avatar, Badge, ButtonLink, Callout, Card, EmptyState, InfoItem, MenuLink, MoreMenu, PageHeader, StatusTab, TextLink, checkboxClass, tabBarClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, getHouses, sectionLabel } from "@/lib/queries";
import { HouseBadge } from "@/components/house";
import { removeStudent, restoreStudent, setStudentSubjects, updateStudent } from "../actions";
import { StudentForm } from "../student-form";
import { AdmitCardPanel, ExamsPanel, NoticesPanel, ReportCardPanel, TimetablePanel, TransportPanel } from "@/components/student-profile/panels";
import { TransportAssign } from "@/components/student-profile/transport-assign";
import { studentExams, studentNotices } from "@/lib/student-profile";
import { assignTransport } from "../../transport/actions";
import { todayISO } from "@/lib/attendance-shared";
import { sessionMonths } from "@/lib/fees-shared";
import { getCurrentSession } from "@/lib/sessions";

const TABS = ["overview", "exams", "results", "timetable", "notices", "admit-card", "transport", "documents", "edit"] as const;
type Tab = (typeof TABS)[number];

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function StudentPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const { tab: tabParam, admitted, exam: examParam } = await searchParams;
  const tab: Tab = TABS.find((t) => t === tabParam) ?? "overview";
  const selectedExam = typeof examParam === "string" ? examParam : undefined;
  const school = await getCurrentSchool();
  const [student, classes, allSubjects, houses] = await Promise.all([
    db.student.findFirst({
      where: { id, schoolId: school.id },
      include: {
        section: { include: { class: { include: { subjects: true } } } },
        house: true,
        subjects: true,
        transportRoute: true,
        enrollments: {
          orderBy: { session: { startDate: "desc" } },
          include: { session: true, section: { include: { class: true } } },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            title: true,
            documentNumber: true,
            fileName: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    }),
    getClassesWithSections(school.id),
    db.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" } }),
    getHouses(school.id),
  ]);
  if (!student) notFound();

  const name = fullName(student);
  const allotted = new Set(student.subjects.map((s) => s.subjectId));
  const curriculum = new Set(student.section?.class.subjects.map((s) => s.subjectId) ?? []);
  const removed = student.status === "INACTIVE";

  const tabHref = (t: Tab) => `/admin/students/${student.id}${t === "overview" ? "" : `?tab=${t}`}`;
  const examTabs = tab === "exams" || tab === "results" || tab === "admit-card";
  const [exams, notices, routes, session] = await Promise.all([
    examTabs ? studentExams(student) : [],
    tab === "notices" ? studentNotices(student.id) : [],
    tab === "transport" ? db.transportRoute.findMany({ where: { schoolId: school.id }, orderBy: { routeNumber: "asc" }, select: { id: true, routeNumber: true, name: true, stops: true, stopTimes: true, stopFares: true } }) : [],
    getCurrentSession(school.id),
  ]);
  // The months the transport fee runs, as set now (a new rider starts this month).
  const feeMonths = sessionMonths(session.startDate.toISOString().slice(0, 10));
  const transportFee =
    tab === "transport" ? await db.studentFeeHead.findFirst({ where: { studentId: student.id, head: { sessionId: session.id, transport: true } }, select: { fromDate: true, toDate: true } }) : null;
  const thisMonth = todayISO().slice(0, 7);
  const feeRange = transportFee
    ? { from: transportFee.fromDate?.toISOString().slice(0, 7) ?? null, to: transportFee.toDate?.toISOString().slice(0, 7) ?? null }
    : { from: feeMonths.includes(thisMonth) ? thisMonth : null, to: null };
  const actor = { kind: "admin" as const, schoolId: school.id, who: "" };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: name }]}
        leading={
          <span className="rounded-full ring-4 ring-surface">
            <Avatar name={name} src={photoUrl(student.photoId)} size="xl" />
          </span>
        }
        eyebrow={<span className="font-mono normal-case tracking-normal">{student.studentCode}</span>}
        title={name}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {student.section ? (
              <Badge tone="indigo">{sectionLabel(student.section)}</Badge>
            ) : (
              <Badge tone="amber" dot>
                No class assigned
              </Badge>
            )}
            {student.rollNumber != null && <Badge>Roll {student.rollNumber}</Badge>}
            {student.house && <HouseBadge house={student.house} />}
            {student.bloodGroup && (
              <Badge tone="red">
                <Droplet className="h-3 w-3" />
                {BLOOD_GROUP_LABELS[student.bloodGroup]}
              </Badge>
            )}
            {removed ? (
              <Badge tone="red" dot>
                Removed
              </Badge>
            ) : (
              <Badge tone="green" dot>
                Active
              </Badge>
            )}
          </span>
        }
        action={
          <>
            {!removed && (
              <MoreMenu>
                <MenuLink href={`/admin/students/${student.id}/acknowledgement`} icon={<FileCheck2 />}>
                  Admission acknowledgement
                </MenuLink>
                <MenuLink href={`/admin/id-cards/generate?ids=${student.id}`} icon={<IdCard />}>
                  Generate ID card
                </MenuLink>
                {student.section && (
                  <MenuLink href={`/admin/attendance/register?section=${student.section.id}`} icon={<CalendarDays />}>
                    Attendance register
                  </MenuLink>
                )}
                <MenuLink href={tabHref("edit")} icon={<Pencil />}>
                  Edit details
                </MenuLink>
              </MoreMenu>
            )}
            <ButtonLink href={`/admin/fees/students/${student.id}`} icon={Wallet}>
              Fees
            </ButtonLink>
          </>
        }
      />

      {admitted && !removed && tab === "overview" && (
        <Callout
          icon={CircleCheck}
          tone="success"
          className="mb-6"
          action={
            <span className="flex flex-wrap items-center gap-2">
              {student.section ? (
                <ButtonLink href={`/admin/fees/students/${student.id}`} icon={Wallet} size="sm">
                  Collect fees
                </ButtonLink>
              ) : (
                <ButtonLink href={tabHref("edit")} icon={Pencil} size="sm">
                  Assign a class
                </ButtonLink>
              )}
              <ButtonLink href={tabHref("overview")} variant="ghost" size="sm">
                Later
              </ButtonLink>
            </span>
          }
        >
          <strong className="font-semibold">Admission saved.</strong> {name} is now {student.studentCode}.{" "}
          {student.section
            ? "Collect the admission and first fees now?"
            : "Assign a class to charge fees. They're set per class."}
        </Callout>
      )}

      <div className="mb-6 border-b border-line">
        <nav aria-label="Student sections" className={tabBarClass}>
          <StatusTab href={tabHref("overview")} active={tab === "overview"} label="Overview" icon={LayoutGrid} />
          <StatusTab href={tabHref("exams")} active={tab === "exams"} label="Examinations" icon={ClipboardList} />
          <StatusTab href={tabHref("results")} active={tab === "results"} label="Report card" icon={FileBarChart} />
          <StatusTab href={tabHref("timetable")} active={tab === "timetable"} label="Timetable" icon={CalendarClock} />
          <StatusTab href={tabHref("notices")} active={tab === "notices"} label="Notices" icon={Megaphone} />
          <StatusTab href={tabHref("admit-card")} active={tab === "admit-card"} label="Admit card" icon={Ticket} />
          <StatusTab href={tabHref("transport")} active={tab === "transport"} label="Transport" icon={Bus} />
          <StatusTab href={tabHref("documents")} active={tab === "documents"} label="Documents" icon={FileText} count={student.documents.length} />
          <StatusTab href={tabHref("edit")} active={tab === "edit"} label="Edit details" icon={Pencil} />
        </nav>
      </div>

      {tab === "exams" && <ExamsPanel exams={exams} reportHref={(e) => `${tabHref("results")}&exam=${e.id}`} />}
      {tab === "results" && (
        <ReportCardPanel
          actor={actor}
          studentId={student.id}
          exams={exams}
          selected={selectedExam}
          tabHref={(examId) => `${tabHref("results")}&exam=${examId}`}
          cardHref={(e) => `/admin/results/${e.id}/${e.sectionId}?student=${student.id}`}
        />
      )}
      {tab === "timetable" && <TimetablePanel schoolId={school.id} sectionId={student.sectionId} />}
      {tab === "notices" && <NoticesPanel notices={notices} noticeHref={(nid) => `/admin/notices/${nid}`} />}
      {tab === "admit-card" && (
        <AdmitCardPanel
          schoolId={school.id}
          studentId={student.id}
          exams={exams.filter((e) => e.sectionId === student.sectionId)}
          selected={selectedExam}
          tabHref={(examId) => `${tabHref("admit-card")}&exam=${examId}`}
          cardHref={(e) => `/admin/admit-cards/${e.id}/${e.sectionId}?student=${student.id}`}
        />
      )}
      {tab === "transport" && (
        <TransportPanel
          route={student.transportRoute}
          stop={student.transportStop}
          routeHref={student.transportRoute ? `/admin/transport/${student.transportRoute.id}` : undefined}
          assign={
            <TransportAssign
              action={assignTransport.bind(null, student.id)}
              routes={routes}
              routeId={student.transportRouteId}
              stop={student.transportStop}
              months={feeMonths}
              feeRange={feeRange}
            />
          }
        />
      )}

      {tab === "documents" && <DocumentsPanel ownerKind="student" ownerId={student.id} documents={student.documents} />}

      {tab === "edit" && (
        <div className="space-y-6">
          <Card title="Edit details" description="Changes are saved to the student's record.">
            <StudentForm
              action={updateStudent.bind(null, student.id)}
              classes={classes}
              houses={houses}
              student={student}
              photoUrl={photoUrl(student.photoId)}
              submitLabel="Save changes"
            />
          </Card>
          <Card
            title={removed ? "Restore student" : "Remove student"}
            description={
              removed
                ? "Bring this student back to the active list, or delete them for good."
                : "The record, fees and attendance are kept, and the student can be restored later."
            }
            className={removed ? undefined : "border-danger-line"}
          >
            {removed ? (
              <div className="flex flex-wrap items-center gap-3">
                <ActionForm action={restoreStudent.bind(null, student.id)} compact className="flex items-center gap-3">
                  <SubmitButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />}>
                    Restore student
                  </SubmitButton>
                </ActionForm>
                <DeletePermanently kind="student" action={deletePermanently.bind(null, "student", student.id)} schoolCode={school.code} title={`Delete ${fullName(student)} permanently?`} />
              </div>
            ) : (
              <ActionForm action={removeStudent.bind(null, student.id)} compact className="flex items-center gap-3">
                <SubmitButton
                  variant="danger"
                  confirm={`Remove ${name}?`}
                  confirmMessage="The record is kept and can be restored."
                  icon={<UserRoundX className="h-4 w-4" />}
                >
                  Remove student
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
        </div>
      )}

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Family & admission" icon={UserRound} action={<TextLink href={tabHref("edit")}>Edit</TextLink>}>
              <dl className="grid gap-6 sm:grid-cols-2">
                <InfoItem icon={UserRound} label="Father">
                  {student.fatherName ?? "—"}
                  {student.fatherOccupation && <span className="block text-muted">{student.fatherOccupation}</span>}
                </InfoItem>
                <InfoItem icon={UserRound} label="Mother">
                  {student.motherName ?? "—"}
                  {student.guardianName && student.guardianName !== student.fatherName && (
                    <span className="block text-muted">
                      Guardian: {student.guardianName}
                      {student.guardianRelation && ` (${student.guardianRelation})`}
                    </span>
                  )}
                </InfoItem>
                <InfoItem icon={Phone} label="Phone">
                  {student.phone ? (
                    <a href={`tel:${student.phone}`} className="rounded font-medium text-accent-text hover:underline">
                      {student.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </InfoItem>
                <InfoItem icon={Mail} label="Email">
                  {student.email ?? "—"}
                </InfoItem>
                <InfoItem icon={CalendarDays} label="Admitted on">
                  {dateFormat.format(student.admissionDate)}
                </InfoItem>
                <InfoItem icon={Hash} label="Subjects">
                  {allotted.size} allotted
                </InfoItem>
              </dl>
            </Card>

            <Card
              title="Allotted subjects"
              icon={BookOpen}
              description={
                student.section
                  ? `Tagged subjects are part of ${student.section.class.name}'s curriculum.`
                  : "Assign a class to allot its curriculum automatically."
              }
            >
              {allSubjects.length === 0 ? (
                <EmptyState
                  compact
                  icon={BookOpen}
                  title="No subjects yet"
                  action={
                    <ButtonLink href="/admin/subjects" variant="secondary" size="sm">
                      Add subjects
                    </ButtonLink>
                  }
                />
              ) : (
                <ActionForm
                  // Resync when a class change elsewhere on the page resets the allotment.
                  syncKey={[...allotted].sort().join()}
                  action={setStudentSubjects.bind(null, student.id)}
                  className="space-y-4"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allSubjects.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm transition hover:border-accent-line has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft"
                      >
                        <input type="checkbox" name="subjectIds" value={s.id} defaultChecked={allotted.has(s.id)} className={checkboxClass} />
                        <span className="flex-1 font-medium text-fg-2">{s.name}</span>
                        {curriculum.has(s.id) && <Badge tone="indigo">Curriculum</Badge>}
                        <span className="font-mono text-[11px] text-subtle">{s.code}</span>
                      </label>
                    ))}
                  </div>
                  <SubmitButton>Save subjects</SubmitButton>
                </ActionForm>
              )}
            </Card>
          </div>

          <div className="space-y-6 self-start">
            <AttendanceSummaryCard
              schoolId={school.id}
              studentId={student.id}
              registerHref={student.section ? `/admin/attendance/register?section=${student.section.id}` : null}
            />

            <Card title="Class history" icon={History} padded={false}>
              {student.enrollments.length === 0 ? (
                <p className="p-6 text-sm text-muted">No class assigned yet.</p>
              ) : (
                <ol className="relative px-6 py-4">
                  {student.enrollments.map((e, i) => (
                    <li key={e.id} className="relative flex items-center justify-between gap-3 py-3 pl-6 text-sm">
                      <span
                        aria-hidden
                        className={`absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-4 ring-surface ${i === 0 ? "bg-accent" : "bg-line-strong"}`}
                      />
                      {i < student.enrollments.length - 1 && <span aria-hidden className="absolute left-[4.5px] top-1/2 h-full w-px bg-line" />}
                      <div>
                        <p className="font-medium text-fg">{e.session.name}</p>
                        <p className="text-xs text-muted">
                          {sectionLabel(e.section)}
                          {e.rollNumber != null && <> · Roll {e.rollNumber}</>}
                        </p>
                      </div>
                      <EnrollmentStatus status={e.session.status} result={e.result} />
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

const RESULT_BADGES = {
  PROMOTED: { tone: "indigo", label: "Promoted" },
  DETAINED: { tone: "amber", label: "Repeating" },
  LEFT: { tone: "slate", label: "Left school" },
  PASSED_OUT: { tone: "green", label: "Passed out" },
} as const;

function EnrollmentStatus({
  status,
  result,
}: {
  status: "UPCOMING" | "CURRENT" | "CLOSED";
  result: keyof typeof RESULT_BADGES | null;
}) {
  if (result) return <Badge tone={RESULT_BADGES[result].tone}>{RESULT_BADGES[result].label}</Badge>;
  if (status === "CURRENT") return <Badge tone="green" dot>Current</Badge>;
  if (status === "UPCOMING") return <Badge tone="sky">Next year</Badge>;
  return <Badge>Completed</Badge>;
}
