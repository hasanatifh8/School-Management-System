import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  Crown,
  Droplet,
  GraduationCap,
  Mail,
  Phone,
  RotateCcw,
  UserRoundX,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DocumentsPanel } from "../../documents/documents-panel";
import { Avatar, Badge, Card, IconTile, InfoItem, PageHeader, StatusTab } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import {
  changeTeacherUsername,
  issueTeacherLogin,
  removeTeacher,
  removeTeacherLogin,
  restoreTeacher,
  setTeacherLoginEnabled,
  updateTeacher,
} from "../actions";
import { TeacherLoginCard } from "./teacher-login-card";
import { TeacherForm } from "../teacher-form";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function TeacherPage({ params, searchParams }: PageProps<"/admin/teachers/[id]">) {
  const { id } = await params;
  const tab = (await searchParams).tab === "documents" ? "documents" : "profile";
  const school = await getCurrentSchool();
  const teacher = await db.teacher.findFirst({
    where: { id, schoolId: school.id },
    include: {
      classTeacherOf: {
        include: { class: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      },
      subjectAssignments: {
        include: { subject: true, section: { include: { class: true } } },
        orderBy: [{ section: { class: { sortOrder: "asc" } } }, { section: { name: "asc" } }],
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
  });
  if (!teacher) notFound();

  const name = fullName(teacher);
  const removed = teacher.status === "INACTIVE";

  return (
    <>
      <PageHeader
        title="Teacher profile"
        breadcrumbs={[{ label: "Teachers", href: "/admin/teachers" }, { label: name }]}
      />

      {/* Profile summary */}
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500" />
        <div className="px-6 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="-mt-8 rounded-full ring-4 ring-white">
                <Avatar name={name} src={photoUrl(teacher.photoId)} size="xl" />
              </span>
              <div className="pt-3">
                <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-slate-500">{teacher.employeeCode}</span>
                  {teacher.bloodGroup && (
                    <Badge tone="red">
                      <Droplet className="h-3 w-3" />
                      {BLOOD_GROUP_LABELS[teacher.bloodGroup]}
                    </Badge>
                  )}
                  {teacher.classTeacherOf && (
                    <Badge tone="indigo">
                      <Crown className="h-3 w-3" />
                      Class teacher · {sectionLabel(teacher.classTeacherOf)}
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
              <ActionForm action={restoreTeacher.bind(null, teacher.id)} compact className="flex items-center gap-3 pt-3">
                <SubmitButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />}>
                  Restore teacher
                </SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={removeTeacher.bind(null, teacher.id)} compact className="flex items-center gap-3 pt-3">
                <SubmitButton
                  variant="dangerGhost"
                  confirm={`Remove ${name}? Their class teacher and subject roles will be cleared.`}
                  icon={<UserRoundX className="h-4 w-4" />}
                >
                  Remove teacher
                </SubmitButton>
              </ActionForm>
            )}
          </div>

          <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem icon={GraduationCap} label="Qualification">
              {teacher.qualification ?? "—"}
            </InfoItem>
            <InfoItem icon={BookOpen} label="Specialization">
              {teacher.specialization ?? "—"}
            </InfoItem>
            <InfoItem icon={Briefcase} label="Experience">
              {teacher.experienceYears == null
                ? "—"
                : `${teacher.experienceYears} year${teacher.experienceYears === 1 ? "" : "s"}`}
            </InfoItem>
            <InfoItem icon={Phone} label="Phone">
              {teacher.phone ?? "—"}
              {teacher.whatsappNumber && teacher.whatsappNumber !== teacher.phone && (
                <span className="block text-slate-500">WhatsApp {teacher.whatsappNumber}</span>
              )}
            </InfoItem>
            <InfoItem icon={Mail} label="Email">
              {teacher.email ?? "—"}
            </InfoItem>
            <InfoItem icon={CalendarDays} label="Joined on">
              {dateFormat.format(teacher.joiningDate)}
              {teacher.dateOfBirth && <span className="block text-slate-500">Born {dateFormat.format(teacher.dateOfBirth)}</span>}
            </InfoItem>
          </dl>
        </div>
      </section>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6 text-sm font-medium">
          <StatusTab href={`/admin/teachers/${teacher.id}`} active={tab === "profile"} label="Profile" />
          <StatusTab
            href={`/admin/teachers/${teacher.id}?tab=documents`}
            active={tab === "documents"}
            label="Documents"
            count={teacher.documents.length}
          />
        </nav>
      </div>

      {tab === "documents" ? (
        <DocumentsPanel ownerKind="teacher" ownerId={teacher.id} documents={teacher.documents} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Edit profile" description="Changes are saved to the teacher's record." className="xl:col-span-2">
            <TeacherForm
              action={updateTeacher.bind(null, teacher.id)}
              teacher={teacher}
              photoUrl={photoUrl(teacher.photoId)}
              submitLabel="Save changes"
            />
          </Card>

          <div className="space-y-6 self-start">
            <TeacherLoginCard
              username={teacher.username}
              hasLogin={Boolean(teacher.passwordHash)}
              enabled={teacher.loginEnabled}
              lastLoginAt={teacher.lastLoginAt ? dateTimeFormat.format(teacher.lastLoginAt) : null}
              issue={issueTeacherLogin.bind(null, teacher.id)}
              changeUsername={changeTeacherUsername.bind(null, teacher.id)}
              setEnabled={setTeacherLoginEnabled.bind(null, teacher.id)}
              remove={removeTeacherLogin.bind(null, teacher.id)}
            />

            <Card title="Class teacher" icon={Crown} description="Assigned from the class's page.">
              {teacher.classTeacherOf ? (
                <Link
                  href={`/admin/classes/${teacher.classTeacherOf.classId}`}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <IconTile icon={GraduationCap} tone="indigo" size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{sectionLabel(teacher.classTeacherOf)}</p>
                    <p className="text-xs text-slate-500">{teacher.classTeacherOf._count.students} active students</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                </Link>
              ) : (
                <p className="text-sm text-slate-500">Not a class teacher.</p>
              )}
            </Card>

            <Card
              title="Subjects taught"
              icon={BookOpen}
              description={`${teacher.subjectAssignments.length} class assignment(s)`}
              padded={false}
            >
              {teacher.subjectAssignments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No subjects assigned yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {teacher.subjectAssignments.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/admin/classes/${a.section.classId}`}
                        className="flex items-center justify-between gap-3 px-6 py-3 text-sm transition hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-800">{a.subject.name}</span>
                        <Badge>{sectionLabel(a.section)}</Badge>
                      </Link>
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
