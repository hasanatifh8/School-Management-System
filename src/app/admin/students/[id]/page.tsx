import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, Hash, Mail, Phone, RotateCcw, UserRoundX } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DocumentsPanel } from "../../documents/documents-panel";
import { Avatar, Badge, Card, InfoItem, PageHeader, StatusTab, checkboxClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, sectionLabel } from "@/lib/queries";
import { removeStudent, restoreStudent, setStudentSubjects, updateStudent } from "../actions";
import { StudentForm } from "../student-form";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function StudentPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const tab = (await searchParams).tab === "documents" ? "documents" : "profile";
  const school = await getCurrentSchool();
  const [student, classes, allSubjects] = await Promise.all([
    db.student.findFirst({
      where: { id, schoolId: school.id },
      include: {
        section: { include: { class: { include: { subjects: true } } } },
        subjects: true,
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
                  {student.section ? (
                    <Badge tone="indigo">{sectionLabel(student.section)}</Badge>
                  ) : (
                    <Badge tone="amber" dot>
                      No class assigned
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
                </div>
              </div>
            </div>
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

          <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem icon={Phone} label="Father">
              {student.fatherName ?? "—"}
              {student.fatherPhone && <span className="block text-slate-500">{student.fatherPhone}</span>}
            </InfoItem>
            <InfoItem icon={Phone} label="Mother">
              {student.motherName ?? "—"}
              {student.motherPhone && <span className="block text-slate-500">{student.motherPhone}</span>}
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
              student={student}
              photoUrl={photoUrl(student.photoId)}
              submitLabel="Save changes"
            />
          </Card>

          <Card
            title="Allotted subjects"
            icon={BookOpen}
            description={
              student.section
                ? `Tagged subjects are part of ${student.section.class.name}'s curriculum.`
                : "Assign a class to allot its curriculum automatically."
            }
            className="self-start"
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
        </div>
      )}
    </>
  );
}
