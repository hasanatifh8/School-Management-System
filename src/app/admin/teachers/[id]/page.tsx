import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Crown,
  Droplet,
  FileText,
  GraduationCap,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Layers,
  Phone,
  Printer,
  RotateCcw,
  UserRound,
  UserRoundX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DeletePermanently } from "@/components/delete-permanently";
import { deletePermanently } from "../../permanent-delete-actions";
import { DocumentsPanel } from "../../documents/documents-panel";
import { Avatar, Badge, ButtonLink, Card, IconTile, PageHeader, StatCard, StatGrid, StatusTab, tabBarClass, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { loadTeacherTimetable } from "@/lib/timetable";
import { DAY_NAMES, periodTime } from "@/lib/timetable-shared";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
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

const TABS = ["overview", "timetable", "edit", "documents"] as const;
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
  const allSubjects = await db.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
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
      canTeach: { include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } },
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
  const timetable = await loadTeacherTimetable(school.id, teacher.id);

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
        breadcrumbs={[{ label: "Teachers", href: "/admin/teachers" }, { label: name }]}
        leading={
          <span className="rounded-full ring-4 ring-surface">
            <Avatar name={name} src={photoUrl(teacher.photoId)} size="xl" />
          </span>
        }
        eyebrow={<span className="font-mono normal-case tracking-normal">{teacher.employeeCode}</span>}
        title={name}
        subtitle={
          <>
            <span>{[teacher.specialization, teacher.qualification].filter(Boolean).join(" · ") || "Teacher"}</span>
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {teacher.classTeacherOf && (
                <Badge tone="indigo">
                  <Crown className="h-3 w-3" />
                  Class teacher · {sectionLabel(teacher.classTeacherOf)}
                </Badge>
              )}
              {[...subjects.values()].slice(0, 3).map((s) => (
                <Badge key={s.code} tone="sky">
                  <BookOpen className="h-3 w-3" />
                  {s.name}
                </Badge>
              ))}
              {subjects.size > 3 && <Badge>+{subjects.size - 3} more</Badge>}
              {teacher.bloodGroup && (
                <Badge tone="red">
                  <Droplet className="h-3 w-3" />
                  {BLOOD_GROUP_LABELS[teacher.bloodGroup]}
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
          </>
        }
        action={
          tab !== "edit" && (
            <ButtonLink href={`${base}?tab=edit`} icon={Pencil} variant="secondary">
              Edit profile
            </ButtonLink>
          )
        }
      />

      <div className="mb-6 border-b border-line">
        <nav aria-label="Teacher sections" className={tabBarClass}>
          <StatusTab href={base} active={tab === "overview"} label="Overview" icon={LayoutGrid} />
          <StatusTab href={`${base}?tab=timetable`} active={tab === "timetable"} label="Timetable" icon={CalendarClock} count={timetable.count} />
          <StatusTab href={`${base}?tab=edit`} active={tab === "edit"} label="Edit profile" icon={Pencil} />
          <StatusTab href={`${base}?tab=documents`} active={tab === "documents"} label="Documents" icon={FileText} count={teacher.documents.length} />
        </nav>
      </div>

      {tab === "timetable" && <TeacherTimetable timetable={timetable} teacherId={teacher.id} />}

      {tab === "documents" && <DocumentsPanel ownerKind="teacher" ownerId={teacher.id} documents={teacher.documents} />}

      {tab === "edit" && (
        <div className="space-y-6">
          <Card title="Edit profile" description="Changes are saved to the teacher's record.">
            <TeacherForm
              action={updateTeacher.bind(null, teacher.id)}
              teacher={teacher}
              photoUrl={photoUrl(teacher.photoId)}
              subjects={allSubjects}
              teacherSubjectIds={teacher.canTeach.map((c) => c.subjectId)}
              submitLabel="Save changes"
              cancelHref={base}
            />
          </Card>
          <Card
            title={removed ? "Restore teacher" : "Remove teacher"}
            description={
              removed
                ? "Bring this teacher back to the active list, or delete them for good."
                : "Their class teacher and subject roles are cleared. The record is kept and can be restored."
            }
            className={removed ? undefined : "border-danger-line"}
          >
            {removed ? (
              <div className="flex flex-wrap items-center gap-3">
                <ActionForm action={restoreTeacher.bind(null, teacher.id)} compact className="flex items-center gap-3">
                  <SubmitButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />}>
                    Restore teacher
                  </SubmitButton>
                </ActionForm>
                <DeletePermanently kind="teacher" action={deletePermanently.bind(null, "teacher", teacher.id)} schoolCode={school.code} title={`Delete ${name} permanently?`} />
              </div>
            ) : (
              <ActionForm action={removeTeacher.bind(null, teacher.id)} compact className="flex items-center gap-3">
                <SubmitButton
                  variant="danger"
                  confirm={`Remove ${name}?`}
                  confirmMessage="Their class teacher and subject roles will be cleared."
                  icon={<UserRoundX className="h-4 w-4" />}
                >
                  Remove teacher
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-6">
          <StatGrid>
            <StatCard
              icon={CalendarDays}
              tone="emerald"
              label="At this school"
              value={durationSince(teacher.joiningDate)}
              detail={`Joined ${dateFormat.format(teacher.joiningDate)}`}
            />
            <StatCard
              icon={Briefcase}
              tone="sky"
              label="Experience"
              value={teacher.experienceYears == null ? "—" : `${teacher.experienceYears} yr${teacher.experienceYears === 1 ? "" : "s"}`}
              detail="Total teaching experience"
            />
            <StatCard
              icon={BookOpen}
              tone="violet"
              label="Teaches"
              value={`${subjects.size} subject${subjects.size === 1 ? "" : "s"}`}
              detail={`${teacher.subjectAssignments.length} class assignment${teacher.subjectAssignments.length === 1 ? "" : "s"}`}
            />
            <StatCard
              icon={Wallet}
              tone="amber"
              label="Monthly salary"
              value={teacher.monthlySalary == null ? "—" : rupees(teacher.monthlySalary)}
              detail={teacher.salaryPayments[0] ? `Last paid for ${monthFormat.format(new Date(`${teacher.salaryPayments[0].month}-01`))}` : "No payments yet"}
            />
          </StatGrid>

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
                          <span className="text-muted"> · {ageOn(teacher.dateOfBirth)} yrs</span>
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
                        <a href={`tel:${teacher.phone}`} className="rounded text-accent-text underline-offset-4 hover:underline">
                          {teacher.phone}
                        </a>
                      )}
                    </Detail>
                    <Detail label="WhatsApp" icon={MessageCircle}>
                      {teacher.whatsappNumber && (
                        <a href={`https://wa.me/91${teacher.whatsappNumber}`} target="_blank" rel="noreferrer" className="rounded text-accent-text underline-offset-4 hover:underline">
                          {teacher.whatsappNumber}
                        </a>
                      )}
                    </Detail>
                    <Detail label="Email" icon={Mail}>
                      {teacher.email && (
                        <a href={`mailto:${teacher.email}`} className="break-all rounded text-accent-text underline-offset-4 hover:underline">
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
                  <Detail label="Can teach">{teacher.canTeach.length > 0 && teacher.canTeach.map((c) => c.subject.name).join(", ")}</Detail>
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
                  <p className="p-6 text-sm text-muted">No subjects assigned yet.</p>
                ) : (
                  <ul className="grid gap-3 p-6 sm:grid-cols-2">
                    {[...subjects.values()].map((s) => (
                      <li key={s.code} className="rounded-xl border border-line p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-fg">{s.name}</p>
                          <span className="font-mono text-xs text-subtle">{s.code}</span>
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
                    className="group flex items-center gap-3 rounded-xl border border-line p-3 transition hover:-translate-y-px hover:border-accent-line hover:bg-accent-soft"
                  >
                    <IconTile icon={GraduationCap} tone="indigo" size="sm" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-fg">{sectionLabel(teacher.classTeacherOf)}</p>
                      <p className="text-xs text-muted">{teacher.classTeacherOf._count.students} active students</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-subtle group-hover:text-accent-text" />
                  </Link>
                ) : (
                  <p className="text-sm text-muted">Not a class teacher.</p>
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
                  <p className="p-6 text-sm text-muted">No salary paid yet. Pay it from Expenses → Salaries.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {teacher.salaryPayments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                        <div>
                          <p className="font-medium text-fg">{monthFormat.format(new Date(`${p.month}-01`))}</p>
                          <p className="text-xs text-muted">
                            {MODE_LABELS[p.mode]} · paid {dateFormat.format(p.paidOn)}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-fg">{rupees(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Documents" icon={FileText}>
                <p className="text-sm text-muted">
                  {teacher.documents.length
                    ? `${teacher.documents.length} document${teacher.documents.length === 1 ? "" : "s"} on file.`
                    : "No documents uploaded yet."}
                </p>
                <Link href={`${base}?tab=documents`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-text underline-offset-4 hover:underline">
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

/** The periods this teacher is given in class timetables, as a week grid and a day-by-day list. */
function TeacherTimetable({ timetable: t, teacherId }: { timetable: Awaited<ReturnType<typeof loadTeacherTimetable>>; teacherId: string }) {
  const byDay = t.days.map((day) => ({ day, entries: t.entries.filter((e) => e.day === day) })).filter((d) => d.entries.length);
  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard icon={CalendarClock} tone="indigo" label="Periods a week" value={t.count} detail={`Across ${t.days.length} school day${t.days.length === 1 ? "" : "s"}`} />
        <StatCard icon={Layers} tone="sky" label="Sections" value={t.sectionCount} detail="Classes with at least one period" />
      </StatGrid>
      <Card
        title="Weekly timetable"
        icon={CalendarClock}
        description="Filled in from each class's timetable."
        action={
          <ButtonLink href={`/admin/timetable/teachers/${teacherId}`} variant="ghost" size="sm" icon={Printer}>
            Open full view
          </ButtonLink>
        }
      >
        {!t.periods.some((p) => !p.isBreak) ? (
          <p className="text-sm text-muted">
            The bell schedule has no periods yet.{" "}
            <Link href="/admin/timetable/periods" className="font-medium text-accent-text hover:underline">
              Set up periods
            </Link>
          </p>
        ) : t.count === 0 ? (
          <p className="text-sm text-muted">
            No periods assigned yet. Choose this teacher for a period in a{" "}
            <Link href="/admin/timetable" className="font-medium text-accent-text hover:underline">
              class timetable
            </Link>
            .
          </p>
        ) : (
          <TimetableGrid days={t.days} periods={t.periods} cells={t.cells} />
        )}
      </Card>
      {byDay.length > 0 && (
        <Card title="Day by day" icon={CalendarDays} padded={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Day</th>
                  <th className={thClass}>Time</th>
                  <th className={thClass}>Class</th>
                  <th className={thClass}>Subject</th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {byDay.flatMap(({ day, entries }) =>
                  entries.map((e, i) => (
                    <tr key={`${day}:${e.period.id}`}>
                      <td className={`${tdClass} font-medium text-fg`}>{i === 0 ? DAY_NAMES[day] : ""}</td>
                      <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                        {periodTime(e.period)} <span className="text-xs text-muted">· {e.period.name}</span>
                      </td>
                      <td className={tdClass}>
                        <Link href={`/admin/timetable/class/${e.sectionId}`} className="text-accent-text hover:underline">
                          {e.section}
                        </Link>
                      </td>
                      <td className={`${tdClass} text-fg`}>{e.subject}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
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
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
      <div className="min-w-0">
        <dt className="text-eyebrow uppercase text-muted">{label}</dt>
        <dd className={`mt-0.5 break-words text-sm ${empty ? "text-subtle" : "text-fg"}`}>{empty ? "Not added" : children}</dd>
      </div>
    </div>
  );
}
