import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  Crown,
  Droplet,
  FileText,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  UserRound,
  UserRoundX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DocumentsPanel } from "../../documents/documents-panel";
import { Avatar, Badge, ButtonLink, Card, IconTile, PageHeader, StatusTab, type IconTone } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
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
const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const GENDER_LABELS = { MALE: "Male", FEMALE: "Female", OTHER: "Other" } as const;

const TABS = ["overview", "edit", "documents"] as const;
type Tab = (typeof TABS)[number];

/** Whole years and months from a date until today (India), e.g. "3 yrs 2 mos". */
function durationSince(date: Date) {
  const [ty, tm, td] = todayISO().split("-").map(Number);
  let months = (ty - date.getUTCFullYear()) * 12 + (tm - 1 - date.getUTCMonth());
  if (td < date.getUTCDate()) months--;
  if (months < 1) return "New";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr${y === 1 ? "" : "s"}`, m && `${m} mo${m === 1 ? "" : "s"}`].filter(Boolean).join(" ");
}

function ageOn(dob: Date) {
  const [ty, tm, td] = todayISO().split("-").map(Number);
  const beforeBirthday = tm - 1 < dob.getUTCMonth() || (tm - 1 === dob.getUTCMonth() && td < dob.getUTCDate());
  return ty - dob.getUTCFullYear() - (beforeBirthday ? 1 : 0);
}

export default async function TeacherPage({ params, searchParams }: PageProps<"/admin/teachers/[id]">) {
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find((t) => t === requested) ?? "overview";
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
      salaryPayments: { orderBy: [{ month: "desc" }, { createdAt: "desc" }], take: 6 },
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
  const base = `/admin/teachers/${teacher.id}`;

  // One row per subject, with every section it is taught in.
  const subjects = new Map<string, { name: string; code: string; sections: { id: string; classId: string; label: string }[] }>();
  for (const a of teacher.subjectAssignments) {
    const row = subjects.get(a.subjectId) ?? { name: a.subject.name, code: a.subject.code, sections: [] };
    row.sections.push({ id: a.section.id, classId: a.section.classId, label: sectionLabel(a.section) });
    subjects.set(a.subjectId, row);
  }

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
                <p className="mt-0.5 text-sm text-slate-500">
                  {[teacher.specialization, teacher.qualification].filter(Boolean).join(" · ") || "Teacher"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge>
                    <Hash className="h-3 w-3" />
                    <span className="font-mono">{teacher.employeeCode}</span>
                  </Badge>
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
                {subjects.size > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-500">Subject teacher:</span>
                    {[...subjects.values()].map((s) => (
                      <Badge key={s.code} tone="sky">
                        <BookOpen className="h-3 w-3" />
                        {s.name} · {s.sections.map((sec) => sec.label).join(", ")}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3">
              {tab !== "edit" && (
                <ButtonLink href={`${base}?tab=edit`} icon={Pencil} variant="secondary">
                  Edit profile
                </ButtonLink>
              )}
              {removed ? (
                <ActionForm action={restoreTeacher.bind(null, teacher.id)} compact className="flex items-center gap-3">
                  <SubmitButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />}>
                    Restore teacher
                  </SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={removeTeacher.bind(null, teacher.id)} compact className="flex items-center gap-3">
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
          </div>
        </div>
      </section>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6 text-sm font-medium">
          <StatusTab href={base} active={tab === "overview"} label="Overview" />
          <StatusTab href={`${base}?tab=edit`} active={tab === "edit"} label="Edit profile" />
          <StatusTab href={`${base}?tab=documents`} active={tab === "documents"} label="Documents" count={teacher.documents.length} />
        </nav>
      </div>

      {tab === "documents" && <DocumentsPanel ownerKind="teacher" ownerId={teacher.id} documents={teacher.documents} />}

      {tab === "edit" && (
        <Card title="Edit profile" description="Changes are saved to the teacher's record." className="mx-auto max-w-5xl">
          <TeacherForm
            action={updateTeacher.bind(null, teacher.id)}
            teacher={teacher}
            photoUrl={photoUrl(teacher.photoId)}
            submitLabel="Save changes"
            cancelHref={base}
          />
        </Card>
      )}

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              icon={CalendarDays}
              tone="emerald"
              label="At this school"
              value={durationSince(teacher.joiningDate)}
              detail={`Joined ${dateFormat.format(teacher.joiningDate)}`}
            />
            <Stat
              icon={Briefcase}
              tone="sky"
              label="Experience"
              value={teacher.experienceYears == null ? "—" : `${teacher.experienceYears} yr${teacher.experienceYears === 1 ? "" : "s"}`}
              detail="Total teaching experience"
            />
            <Stat
              icon={BookOpen}
              tone="violet"
              label="Teaches"
              value={`${subjects.size} subject${subjects.size === 1 ? "" : "s"}`}
              detail={`${teacher.subjectAssignments.length} class assignment${teacher.subjectAssignments.length === 1 ? "" : "s"}`}
            />
            <Stat
              icon={Wallet}
              tone="amber"
              label="Monthly salary"
              value={teacher.monthlySalary == null ? "—" : rupees(teacher.monthlySalary)}
              detail={teacher.salaryPayments[0] ? `Last paid for ${monthFormat.format(new Date(`${teacher.salaryPayments[0].month}-01`))}` : "No payments yet"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <div className="grid gap-6 md:grid-cols-2">
                <Card title="Personal details" icon={UserRound}>
                  <DetailList>
                    <Detail label="Full name">{name}</Detail>
                    <Detail label="Gender">{teacher.gender ? GENDER_LABELS[teacher.gender] : null}</Detail>
                    <Detail label="Date of birth">
                      {teacher.dateOfBirth && (
                        <>
                          {dateFormat.format(teacher.dateOfBirth)}
                          <span className="text-slate-500"> · {ageOn(teacher.dateOfBirth)} yrs</span>
                        </>
                      )}
                    </Detail>
                    <Detail label="Blood group">{teacher.bloodGroup && BLOOD_GROUP_LABELS[teacher.bloodGroup]}</Detail>
                  </DetailList>
                </Card>

                <Card title="Contact" icon={Phone}>
                  <DetailList>
                    <Detail label="Phone" icon={Phone}>
                      {teacher.phone && (
                        <a href={`tel:${teacher.phone}`} className="hover:text-indigo-600">
                          {teacher.phone}
                        </a>
                      )}
                    </Detail>
                    <Detail label="WhatsApp" icon={MessageCircle}>
                      {teacher.whatsappNumber && (
                        <a href={`https://wa.me/91${teacher.whatsappNumber}`} target="_blank" rel="noreferrer" className="hover:text-indigo-600">
                          {teacher.whatsappNumber}
                        </a>
                      )}
                    </Detail>
                    <Detail label="Email" icon={Mail}>
                      {teacher.email && (
                        <a href={`mailto:${teacher.email}`} className="break-all hover:text-indigo-600">
                          {teacher.email}
                        </a>
                      )}
                    </Detail>
                    <Detail label="Address" icon={MapPin}>
                      {teacher.address && <span className="whitespace-pre-line">{teacher.address}</span>}
                    </Detail>
                  </DetailList>
                </Card>
              </div>

              <Card title="Professional details" icon={GraduationCap}>
                <DetailList columns>
                  <Detail label="Employee ID">
                    <span className="font-mono">{teacher.employeeCode}</span>
                  </Detail>
                  <Detail label="Qualification">{teacher.qualification}</Detail>
                  <Detail label="Specialization">{teacher.specialization}</Detail>
                  <Detail label="Experience">
                    {teacher.experienceYears != null && `${teacher.experienceYears} year${teacher.experienceYears === 1 ? "" : "s"}`}
                  </Detail>
                  <Detail label="Joining date">{dateFormat.format(teacher.joiningDate)}</Detail>
                  <Detail label="Monthly salary">{teacher.monthlySalary != null && rupees(teacher.monthlySalary)}</Detail>
                </DetailList>
              </Card>

              <Card
                title="Subjects taught"
                icon={BookOpen}
                description="Assigned from each class's page."
                padded={false}
              >
                {subjects.size === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No subjects assigned yet.</p>
                ) : (
                  <ul className="grid gap-3 p-6 sm:grid-cols-2">
                    {[...subjects.values()].map((s) => (
                      <li key={s.code} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{s.name}</p>
                          <span className="font-mono text-xs text-slate-400">{s.code}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {s.sections.map((sec) => (
                            <Link key={sec.id} href={`/admin/classes/${sec.classId}`} className="transition hover:opacity-80">
                              <Badge tone="indigo">{sec.label}</Badge>
                            </Link>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="space-y-6 self-start">
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

              <Card title="Recent salary" icon={Wallet} padded={false}>
                {teacher.salaryPayments.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No salary paid yet. Pay it from Expenses → Salaries.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {teacher.salaryPayments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{monthFormat.format(new Date(`${p.month}-01`))}</p>
                          <p className="text-xs text-slate-500">
                            {MODE_LABELS[p.mode]} · paid {dateFormat.format(p.paidOn)}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-slate-900">{rupees(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Documents" icon={FileText}>
                <p className="text-sm text-slate-500">
                  {teacher.documents.length
                    ? `${teacher.documents.length} document${teacher.documents.length === 1 ? "" : "s"} on file.`
                    : "No documents uploaded yet."}
                </p>
                <Link href={`${base}?tab=documents`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  {teacher.documents.length ? "View documents" : "Upload documents"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ icon, tone, label, value, detail }: { icon: LucideIcon; tone: IconTone; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <IconTile icon={icon} tone={tone} />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function DetailList({ children, columns = false }: { children: ReactNode; columns?: boolean }) {
  return <dl className={columns ? "grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>{children}</dl>;
}

/** A label and value; empty values show a muted "Not added". */
function Detail({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: ReactNode }) {
  const empty = children == null || children === false || children === "";
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className={`mt-0.5 break-words text-sm ${empty ? "text-slate-400" : "text-slate-800"}`}>{empty ? "Not added" : children}</dd>
      </div>
    </div>
  );
}
