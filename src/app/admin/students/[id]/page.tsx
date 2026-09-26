import { notFound } from "next/navigation";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { BookOpen, CalendarDays, Droplet, FileText, Hash, History, IdCard, LayoutGrid, Mail, Pencil, Phone, RotateCcw, UserRound, UserRoundX, Wallet } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DocumentsPanel } from "../../documents/documents-panel";
import { AttendanceSummaryCard } from "@/components/attendance/attendance-summary";
import { Avatar, Badge, ButtonLink, Card, EmptyState, InfoItem, MenuLink, MoreMenu, PageHeader, StatusTab, TextLink, checkboxClass, tabBarClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, getHouses, sectionLabel } from "@/lib/queries";
import { HouseBadge } from "@/components/house";
import { removeStudent, restoreStudent, setStudentSubjects, updateStudent } from "../actions";
import { StudentForm } from "../student-form";

type Tab = "overview" | "edit" | "documents";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function StudentPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab: Tab = tabParam === "documents" ? "documents" : tabParam === "edit" ? "edit" : "overview";
  const school = await getCurrentSchool();
  const [student, classes, allSubjects, houses] = await Promise.all([
    db.student.findFirst({
      where: { id, schoolId: school.id },
      include: {
        section: { include: { class: { include: { subjects: true } } } },
        house: true,
        subjects: true,
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
                <MenuLink href={`/admin/id-cards/generate?ids=${student.id}`} icon={<IdCard />}>
                  Generate ID card
                </MenuLink>
                {student.section && (
                  <MenuLink href={`/admin/attendance/${student.section.id}/register`} icon={<CalendarDays />}>
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

      <div className="mb-6 border-b border-line">
        <nav aria-label="Student sections" className={tabBarClass}>
          <StatusTab href={tabHref("overview")} active={tab === "overview"} label="Overview" icon={LayoutGrid} />
          <StatusTab href={tabHref("edit")} active={tab === "edit"} label="Edit details" icon={Pencil} />
          <StatusTab href={tabHref("documents")} active={tab === "documents"} label="Documents" icon={FileText} count={student.documents.length} />
        </nav>
      </div>

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
                ? "Bring this student back to the active list."
                : "The record, fees and attendance are kept, and the student can be restored later."
            }
            className={removed ? undefined : "border-danger-line"}
          >
            {removed ? (
              <ActionForm action={restoreStudent.bind(null, student.id)} compact className="flex items-center gap-3">
                <SubmitButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />}>
                  Restore student
                </SubmitButton>
              </ActionForm>
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
                    <span className="block text-muted">Guardian: {student.guardianName}</span>
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
              registerHref={student.section ? `/admin/attendance/${student.section.id}/register` : null}
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
