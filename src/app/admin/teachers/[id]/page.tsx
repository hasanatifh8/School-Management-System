import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
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
  Plane,
  Printer,
  RotateCcw,
  UserRound,
  UserRoundX,
  Wallet,
  type LucideIcon,
  Receipt,
  Banknote,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DeletePermanently } from "@/components/delete-permanently";
import { deletePermanently } from "../../permanent-delete-actions";
import { DocumentsPanel } from "../../documents/documents-panel";
import { LeaveHistory } from "@/components/leave/leave-history";
import { PersonLeaveSetup } from "@/components/leave/person-leave-setup";
import { StaffAttendanceSection } from "@/components/attendance/staff-attendance-section";
import { SalaryTab } from "@/components/payroll/salary-tab";
import { SalaryBreakdown } from "@/components/payroll/salary-breakdown";
import { loadComponents, loadOwnValues } from "@/lib/payroll";
import { computeSalary } from "@/lib/payroll-shared";
import { schoolHolidays } from "@/lib/attendance";
import { leaveBalance, personLeave } from "@/lib/leave";
import { Avatar, Badge, ButtonLink, Card, PageHeader, StatCard, StatGrid, StatusTab, tabBarClass, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { loadTeacherTimetable } from "@/lib/timetable";
import { DAY_NAMES, formatTime, periodTime } from "@/lib/timetable-shared";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { TeachingCard, type SectionChoice } from "@/components/teaching/teaching-card";
import {
  addClassTeacherSection,
  addSubjectAssignment,
  changeTeacherUsername,
  issueTeacherLogin,
  removeClassTeacherSection,
  removeSubjectAssignment,
  removeTeacher,
  removeTeacherLogin,
  setTeacherFeeCollection,
  restoreTeacher,
  setTeacherLoginEnabled,
  updateTeacher,
} from "../actions";
import { PortalLoginCard } from "@/components/portal-login-card";
import { TeacherForm } from "../teacher-form";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const GENDER_LABELS = { MALE: "Male", FEMALE: "Female", OTHER: "Other" } as const;

const TABS = ["overview", "timetable", "attendance", "leave", "salary", "edit", "documents"] as const;
type Tab = (typeof TABS)[number];

/** Whole years and months from a date until today (India), e.g. "3 yrs 2 mos". */

/** Whole months from `date` to today (0 before a month has passed). */
function monthsSince(date: Date) {
  const [ty, tm, td] = todayISO().split("-").map(Number);
  let months = (ty - date.getUTCFullYear()) * 12 + (tm - 1 - date.getUTCMonth());
  if (td < date.getUTCDate()) months--;
  return Math.max(months, 0);
}

/** "3 yrs 2 mos"; "< 1 month" for 0. */
function span(months: number) {
  if (months < 1) return "< 1 month";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr${y === 1 ? "" : "s"}`, m && `${m} mo${m === 1 ? "" : "s"}`].filter(Boolean).join(" ");
}

/**
 * Total experience: the years entered on the teacher's form (before joining)
 * plus the time at this school since the joining date.
 */
function experience(t: { experienceYears: number | null; joiningDate: Date }) {
  const here = monthsSince(t.joiningDate);
  const before = (t.experienceYears ?? 0) * 12;
  return { total: before + here, before, here };
}

function ageOn(dob: Date) {
  const [ty, tm, td] = todayISO().split("-").map(Number);
  const beforeBirthday = tm - 1 < dob.getUTCMonth() || (tm - 1 === dob.getUTCMonth() && td < dob.getUTCDate());
  return ty - dob.getUTCFullYear() - (beforeBirthday ? 1 : 0);
}

export default async function TeacherPage({ params, searchParams }: PageProps<"/admin/teachers/[id]">) {
  const { id } = await params;
  const { tab: requested, month: monthParam, sv } = await searchParams;
  const tab: Tab = TABS.find((t) => t === requested) ?? "overview";
  const school = await getCurrentSchool();
  const [allSubjects, schoolSections] = await Promise.all([
    db.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    // Every section with its class teacher, curriculum and subject teachers, for "Classes & subjects".
    db.section.findMany({
      where: { class: { schoolId: school.id } },
      orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
      include: {
        class: { include: { subjects: { include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } } } },
        classTeacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
        subjectAssignments: { include: { teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } } } },
      },
    }),
  ]);
  const teachingSections: SectionChoice[] = schoolSections.map((sec) => ({
    id: sec.id,
    classId: sec.classId,
    label: sectionLabel(sec),
    classTeacher: sec.classTeacher && { id: sec.classTeacher.id, name: fullName(sec.classTeacher) },
    subjects: sec.class.subjects.map((cs) => {
      const a = sec.subjectAssignments.find((x) => x.subjectId === cs.subjectId);
      return { id: cs.subject.id, name: cs.subject.name, teacher: a ? { id: a.teacher.id, name: fullName(a.teacher) } : null };
    }),
  }));
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
  const [timetable, components, own] = await Promise.all([
    loadTeacherTimetable(school.id, teacher.id),
    loadComponents(school.id),
    loadOwnValues(school.id, { teacherId: teacher.id }),
  ]);
  // The monthly salary as it would be paid: basic pay plus the school's earnings and deductions.
  const salary = teacher.monthlySalary ? computeSalary(teacher.monthlySalary, components, own.get(`T:${teacher.id}`) ?? {}) : null;
  const today = tab === "overview" ? await todaysClasses(school.id, teacher.id, timetable) : { value: "", detail: "" };

  const name = fullName(teacher);
  const exp = experience(teacher);
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
              {teacher.classTeacherOf.length > 0 && (
                <Badge tone="indigo">
                  <Crown className="h-3 w-3" />
                  Class teacher · {teacher.classTeacherOf.map(sectionLabel).join(", ")}
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
          <StatusTab replace href={base} active={tab === "overview"} label="Overview" icon={LayoutGrid} />
          <StatusTab replace href={`${base}?tab=timetable`} active={tab === "timetable"} label="Timetable" icon={CalendarClock} count={timetable.count} />
          <StatusTab replace href={`${base}?tab=attendance`} active={tab === "attendance"} label="Attendance" icon={CalendarCheck} />
          <StatusTab replace href={`${base}?tab=leave`} active={tab === "leave"} label="Leave" icon={Plane} />
          <StatusTab replace href={`${base}?tab=salary`} active={tab === "salary"} label="Salary" icon={Banknote} />
          <StatusTab replace href={`${base}?tab=documents`} active={tab === "documents"} label="Documents" icon={FileText} count={teacher.documents.length} />
        </nav>
      </div>

      {tab === "timetable" && <TeacherTimetable timetable={timetable} teacherId={teacher.id} />}

      {tab === "attendance" && (
        <StaffAttendanceSection
          schoolId={school.id}
          person={{ teacherId: teacher.id }}
          joined={teacher.joiningDate ? teacher.joiningDate.toISOString().slice(0, 10) : null}
          monthHref={`${base}?tab=attendance&month=`}
          month={monthParam}
          register={{ href: "/admin/attendance/staff/register?group=teaching&month=", label: "Full staff register" }}
        />
      )}

      {tab === "leave" && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <LeaveHistory
            leave={await personLeave(school.id, "TEACHER", teacher.id)}
            balance={await leaveBalance(school.id, "TEACHER", teacher.id)}
            noun="teacher"
            openHref={(lid) => `/admin/leave?status=all&q=${encodeURIComponent(teacher.employeeCode)}&open=${lid}`}
            newHref="/admin/leave/new"
          />
          <PersonLeaveSetup schoolId={school.id} person={{ teacherId: teacher.id }} />
        </div>
      )}

      {tab === "documents" && <DocumentsPanel ownerKind="teacher" ownerId={teacher.id} documents={teacher.documents} />}

      {tab === "salary" && (
        <SalaryTab schoolId={school.id} person={{ teacherId: teacher.id }} name={name} basic={teacher.monthlySalary} base={`${base}?tab=salary`} view={sv} month={monthParam} />
      )}

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
              label="Experience"
              value={span(exp.total)}
              detail={exp.before ? `${span(exp.before)} before + ${span(exp.here)} here` : `All here · joined ${dateFormat.format(teacher.joiningDate)}`}
            />
            <StatCard icon={CalendarClock} tone="sky" label="Today's classes" value={today.value} detail={today.detail} href={`${base}?tab=timetable`} />
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
              label="Net salary a month"
              value={salary ? rupees(salary.net) : "—"}
              detail={salary ? `Gross ${rupees(salary.gross)} · deductions ${rupees(salary.deductions)}` : "Salary not set"}
              href={`${base}?tab=salary`}
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
                    {span(exp.total)} in total
                    <span className="block text-xs text-muted">
                      {exp.before ? `${span(exp.before)} before joining` : "No experience before joining"} · {span(exp.here)} at this school
                    </span>
                  </Detail>
                  <Detail label="Joining date">{dateFormat.format(teacher.joiningDate)}</Detail>
                  <Detail label="Basic pay">{teacher.monthlySalary != null && rupees(teacher.monthlySalary)}</Detail>
                </DetailList>
              </Card>

              <TeachingCard
                teacherId={teacher.id}
                sections={teachingSections}
                addClass={addClassTeacherSection.bind(null, teacher.id)}
                removeClass={removeClassTeacherSection.bind(null, teacher.id)}
                addSubject={addSubjectAssignment.bind(null, teacher.id)}
                removeSubject={removeSubjectAssignment.bind(null, teacher.id)}
              />
            </div>

            <div className="space-y-6 self-start">

              <PortalLoginCard
                username={teacher.username}
                hasLogin={Boolean(teacher.passwordHash)}
                enabled={teacher.loginEnabled}
                lastLoginAt={teacher.lastLoginAt ? dateTimeFormat.format(teacher.lastLoginAt) : null}
                issue={issueTeacherLogin.bind(null, teacher.id)}
                changeUsername={changeTeacherUsername.bind(null, teacher.id)}
                setEnabled={setTeacherLoginEnabled.bind(null, teacher.id)}
                remove={removeTeacherLogin.bind(null, teacher.id)}
              />

              <Card
                title="Fee collection"
                icon={Receipt}
                description="Lets this teacher collect fees at the Fee desk with their teacher login, like a cashier. They can't change the fee structure or cancel receipts."
                action={teacher.canCollectFees ? <Badge tone="green" dot>On</Badge> : <Badge>Off</Badge>}
              >
                {!teacher.passwordHash && (
                  <p className="mb-3 text-xs text-warning">Set up their teacher login above first; they collect fees with it.</p>
                )}
                <ActionForm action={setTeacherFeeCollection.bind(null, teacher.id, !teacher.canCollectFees)} compact className="flex flex-wrap items-center gap-3">
                  <SubmitButton variant={teacher.canCollectFees ? "secondary" : "primary"} icon={<Receipt className="h-4 w-4" />}>
                    {teacher.canCollectFees ? "Stop fee collection" : "Allow fee collection"}
                  </SubmitButton>
                </ActionForm>
              </Card>

              <Card
                title="Salary"
                icon={Wallet}
                description={salary ? "Each month's pay, as it appears on the salary slip." : undefined}
                action={
                  <Link href={`${base}?tab=salary`} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
                    {salary ? "Change" : "Set salary"}
                  </Link>
                }
              >
                {salary ? (
                  <SalaryBreakdown salary={salary} />
                ) : (
                  <p className="text-sm text-muted">No salary set yet. Set basic pay and the school&apos;s earnings and deductions in the Salary tab.</p>
                )}
                <div className="mt-5">
                  <p className="mb-2 text-eyebrow uppercase text-muted">Salary slips</p>
                  {teacher.salaryPayments.length === 0 ? (
                    <p className="text-sm text-muted">No salary paid yet. Pay it from Expenses → Salaries.</p>
                  ) : (
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {teacher.salaryPayments.map((p) => (
                        <li key={p.id}>
                          <Link href={`/admin/payslips/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-surface-2">
                            <FileText className="h-4 w-4 shrink-0 text-subtle" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-fg">{monthFormat.format(new Date(`${p.month}-01`))}</span>
                              <span className="block text-xs text-muted">
                                {MODE_LABELS[p.mode]} · paid {dateFormat.format(p.paidOn)}
                                {p.lopDays ? ` · ${p.lopDays} unpaid day${p.lopDays === 1 ? "" : "s"} deducted` : ""}
                              </span>
                            </span>
                            {!p.published && (
                              <Badge tone="amber" dot>
                                Draft
                              </Badge>
                            )}
                            <span className="font-semibold tabular-nums text-fg">{rupees(p.amount)}</span>
                            <ArrowRight className="h-4 w-4 text-subtle" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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

/**
 * The teacher's periods today: their own timetable, less periods handed to a
 * proxy today, plus periods they cover as a proxy; and what is next.
 */
async function todaysClasses(schoolId: string, teacherId: string, timetable: Awaited<ReturnType<typeof loadTeacherTimetable>>) {
  const date = todayISO();
  const day = ((parseISODate(date)!.getUTCDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday, as in the timetable
  const [holidays, proxies] = await Promise.all([
    schoolHolidays(schoolId, date, date),
    db.proxyAssignment.findMany({
      where: { schoolId, date: parseISODate(date)!, OR: [{ absentTeacherId: teacherId }, { proxyTeacherId: teacherId }] },
      include: { slot: { include: { period: true, subject: true, section: { include: { class: true } } } } },
    }),
  ]);
  const holiday = holidays.get(date);
  if (holiday) return { value: "Holiday", detail: holiday.name };
  if (!timetable.days.includes(day)) return { value: "No classes", detail: `${DAY_NAMES[day]} is not a school day` };

  const handedOver = new Set(proxies.filter((p) => p.absentTeacherId === teacherId).map((p) => `${p.slot.periodId}:${p.slot.sectionId}`));
  const classes = [
    ...timetable.entries
      .filter((e) => e.day === day && !handedOver.has(`${e.period.id}:${e.sectionId}`))
      .map((e) => ({ start: e.period.startTime, subject: e.subject, section: e.section, proxy: false })),
    ...proxies
      .filter((p) => p.proxyTeacherId === teacherId)
      .map((p) => ({ start: p.slot.period.startTime, subject: p.slot.subject?.name ?? p.slot.label ?? "", section: sectionLabel(p.slot.section), proxy: true })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  if (!classes.length) return { value: "No classes", detail: handedOver.size ? "All covered by a proxy" : "None on the timetable" };

  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date());
  const next = classes.find((c) => c.start > now);
  const proxyCount = classes.filter((c) => c.proxy).length;
  const what = (c: (typeof classes)[number]) => `${[c.subject, c.section].filter(Boolean).join(" · ")} at ${formatTime(c.start)}${c.proxy ? " (proxy)" : ""}`;
  return {
    value: `${classes.length} period${classes.length === 1 ? "" : "s"}`,
    detail: next ? `Next: ${what(next)}` : `Done for today${proxyCount ? ` · ${proxyCount} as proxy` : ""}`,
  };
}
