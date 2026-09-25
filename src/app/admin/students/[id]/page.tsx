import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { BookOpen, CalendarDays, Droplet, Hash, History, IdCard, Mail, Wallet, RotateCcw, UserRound, UserRoundX } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DocumentsPanel } from "../../documents/documents-panel";
import { AttendanceSummaryCard } from "@/components/attendance/attendance-summary";
import { Avatar, Badge, Card, InfoItem, PageHeader, StatusTab, buttonVariants, checkboxClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, getHouses, sectionLabel } from "@/lib/queries";
import { HouseBadge } from "@/components/house";
import { removeStudent, restoreStudent, setStudentSubjects, updateStudent } from "../actions";
import { StudentForm } from "../student-form";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function StudentPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const tab = (await searchParams).tab === "documents" ? "documents" : "profile";
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

  return (
    <>
      <PageHeader
        title="Student profile"
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: name }]}
      />

      {/* Profile summary */}
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500" />
        <div className="px-6 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="-mt-8 rounded-full ring-4 ring-white">
                <Avatar name={name} src={photoUrl(student.photoId)} size="xl" />
              </span>
              <div className="pt-3">
                <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-slate-500">{student.studentCode}</span>
                  {student.bloodGroup && (
                    <Badge tone="red">
                      <Droplet className="h-3 w-3" />
                      {BLOOD_GROUP_LABELS[student.bloodGroup]}
                    </Badge>
                  )}
                  {student.rollNumber != null && <Badge>Roll {student.rollNumber}</Badge>}
                  {student.section ? (
                    <Badge tone="indigo">{sectionLabel(student.section)}</Badge>
                  ) : (
                    <Badge tone="amber" dot>
                      No class assigned
                    </Badge>
                  )}
                  {student.house && <HouseBadge house={student.house} />}
                  {removed ? (
                    <Badge tone="red" dot>
                      Removed
                    </Badge>
                  ) : (
                    <Badge tone="green" dot>
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Link href={`/admin/fees/students/${student.id}`} className={`${buttonVariants.secondary} mt-3`}>
                <Wallet className="h-4 w-4" />
                Fees
              </Link>
              {!removed && (
                <Link href={`/admin/id-cards/generate?ids=${student.id}`} className={`${buttonVariants.secondary} mt-3`}>
                  <IdCard className="h-4 w-4" />
                  ID card
                </Link>
              )}
              {removed ? (
                <ActionForm action={restoreStudent.bind(null, student.id)} compact className="flex items-center gap-3 pt-3">
                  <SubmitButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />}>
                    Restore student
                  </SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={removeStudent.bind(null, student.id)} compact className="flex items-center gap-3 pt-3">
                  <SubmitButton
                    variant="dangerGhost"
                    confirm={`Remove ${name}? The record is kept and can be restored.`}
                    icon={<UserRoundX className="h-4 w-4" />}
                  >
                    Remove student
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </div>

          <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem icon={UserRound} label="Father">
              {student.fatherName ?? "—"}
              {student.fatherOccupation && <span className="block text-slate-500">{student.fatherOccupation}</span>}
            </InfoItem>
            <InfoItem icon={UserRound} label="Mother">
              {student.motherName ?? "—"}
              {student.guardianName && student.guardianName !== student.fatherName && (
                <span className="block text-slate-500">Guardian: {student.guardianName}</span>
              )}
            </InfoItem>
            <InfoItem icon={CalendarDays} label="Admitted on">
              {dateFormat.format(student.admissionDate)}
            </InfoItem>
            <InfoItem icon={student.email ? Mail : Hash} label={student.email ? "Email" : "Subjects"}>
              {student.email ?? `${allotted.size} allotted`}
            </InfoItem>
          </dl>
        </div>
      </section>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6 text-sm font-medium">
          <StatusTab href={`/admin/students/${student.id}`} active={tab === "profile"} label="Profile" />
          <StatusTab
            href={`/admin/students/${student.id}?tab=documents`}
            active={tab === "documents"}
            label="Documents"
            count={student.documents.length}
          />
        </nav>
      </div>

      {tab === "documents" ? (
        <DocumentsPanel ownerKind="student" ownerId={student.id} documents={student.documents} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Edit profile" description="Changes are saved to the student's record." className="xl:col-span-2">
            <StudentForm
              action={updateStudent.bind(null, student.id)}
              classes={classes}
              houses={houses}
              student={student}
              photoUrl={photoUrl(student.photoId)}
              submitLabel="Save changes"
            />
          </Card>

          <div className="space-y-6 self-start">
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
                <p className="text-sm text-slate-500">
                  No subjects yet.{" "}
                  <Link href="/admin/subjects" className="font-medium text-indigo-600 hover:underline">
                    Add subjects
                  </Link>
                </p>
              ) : (
                <ActionForm
                  // Resync when a class change elsewhere on the page resets the allotment.
                  syncKey={[...allotted].sort().join()}
                  action={setStudentSubjects.bind(null, student.id)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    {allSubjects.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/60"
                      >
                        <input
                          type="checkbox"
                          name="subjectIds"
                          value={s.id}
                          defaultChecked={allotted.has(s.id)}
                          className={checkboxClass}
                        />
                        <span className="flex-1 font-medium text-slate-700">{s.name}</span>
                        {curriculum.has(s.id) && <Badge tone="indigo">Curriculum</Badge>}
                        <span className="font-mono text-[11px] text-slate-400">{s.code}</span>
                      </label>
                    ))}
                  </div>
                  <SubmitButton>Save subjects</SubmitButton>
                </ActionForm>
              )}
            </Card>

            <AttendanceSummaryCard
              schoolId={school.id}
              studentId={student.id}
              registerHref={student.section ? `/admin/attendance/${student.section.id}/register` : null}
            />

            <Card title="Class history" icon={History} padded={false}>
              {student.enrollments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No class assigned yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {student.enrollments.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{e.session.name}</p>
                        <p className="text-xs text-slate-500">
                          {sectionLabel(e.section)}
                          {e.rollNumber != null && <> · Roll {e.rollNumber}</>}
                        </p>
                      </div>
                      <EnrollmentStatus status={e.session.status} result={e.result} />
                    </li>
                  ))}
                </ul>
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
