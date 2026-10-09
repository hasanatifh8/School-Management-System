import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, Droplet, Hash, IdCard, Shield, UserRound, Users } from "lucide-react";
import { DocumentsPanel } from "../../../admin/documents/documents-panel";
import { AttendanceSummaryCard } from "@/components/attendance/attendance-summary";
import { HouseBadge } from "@/components/house";
import { Avatar, Badge, ButtonLink, Card, InfoItem, PageHeader, StatusTab, tabBarClass } from "@/components/ui";
import { AdmitCardPanel, ExamsPanel, NoticesPanel, ReportCardPanel, TimetablePanel, TransportPanel } from "@/components/student-profile/panels";
import { teacherActor } from "@/lib/exams";
import { studentExams, studentNotices } from "@/lib/student-profile";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { db } from "@/lib/db";
import { maskDocumentNumber } from "@/lib/document-types";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { normalizeIndianMobile } from "@/lib/student-options";
import { requireTeacher } from "@/lib/teacher-auth";
import { updateClassStudent } from "../../actions";
import { ClassStudentForm } from "./class-student-form";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A student in the teacher's own class: full details, limited edits, documents. */
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "exams", label: "Examinations" },
  { key: "results", label: "Report card" },
  { key: "timetable", label: "Timetable" },
  { key: "notices", label: "Notices" },
  { key: "admit-card", label: "Admit card" },
  { key: "transport", label: "Transport" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function TeacherStudentPage({ params, searchParams }: PageProps<"/teacher/students/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === sp.tab)?.key ?? "overview";
  const selectedExam = typeof sp.exam === "string" ? sp.exam : undefined;
  const ctx = await requireTeacher();
  if (!ctx.classSections.length) notFound();
  const student = await db.student.findFirst({
    where: { id, schoolId: ctx.school.id, sectionId: { in: ctx.classSections.map((s) => s.id) }, status: "ACTIVE" },
    include: {
      section: { include: { class: true } },
      house: true,
      transportRoute: true,
      enrollments: { select: { sectionId: true } },
      subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, documentNumber: true, fileName: true, mimeType: true, size: true, createdAt: true },
      },
    },
  });
  if (!student) notFound();
  const name = fullName(student);
  const base = `/teacher/students/${student.id}`;
  const tabHref = (t: Tab) => (t === "overview" ? base : `${base}?tab=${t}`);
  const exams = tab === "exams" || tab === "results" || tab === "admit-card" ? await studentExams(student) : [];
  const notices = tab === "notices" ? await studentNotices(student.id) : [];

  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={[{ label: "My class", href: "/teacher/class" }, { label: name }]}
        action={
          <ButtonLink href={`/teacher/id-cards/generate?ids=${student.id}`} variant="secondary" icon={IdCard}>
            ID card
          </ButtonLink>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{student.studentCode}</span>
            {student.section && <Badge tone="indigo">{sectionLabel(student.section)}</Badge>}
            {student.rollNumber != null && <Badge>Roll {student.rollNumber}</Badge>}
            {student.house && <HouseBadge house={student.house} />}
          </span>
        }
      />

      <div className="mb-6 border-b border-line">
        <nav aria-label="Student sections" className={tabBarClass}>
          {TABS.map((t) => (
            <StatusTab key={t.key} href={tabHref(t.key)} active={tab === t.key} label={t.label} />
          ))}
        </nav>
      </div>

      {tab === "exams" && <ExamsPanel exams={exams} reportHref={(e) => `${tabHref("results")}&exam=${e.id}`} />}
      {tab === "results" && (
        <ReportCardPanel
          actor={teacherActor(ctx)}
          studentId={student.id}
          exams={exams}
          selected={selectedExam}
          tabHref={(examId) => `${tabHref("results")}&exam=${examId}`}
          cardHref={(e) => `/teacher/tests/${e.id}/results/${e.sectionId}?student=${student.id}`}
        />
      )}
      {tab === "timetable" && <TimetablePanel schoolId={ctx.school.id} sectionId={student.sectionId} />}
      {tab === "notices" && <NoticesPanel notices={notices} noticeHref={null} />}
      {tab === "admit-card" && (
        <AdmitCardPanel
          schoolId={ctx.school.id}
          studentId={student.id}
          exams={exams.filter((e) => e.sectionId === student.sectionId && e.published)}
          selected={selectedExam}
          tabHref={(examId) => `${tabHref("admit-card")}&exam=${examId}`}
          cardHref={null}
        />
      )}
      {tab === "transport" && <TransportPanel route={student.transportRoute} stop={student.transportStop} />}

      {tab === "overview" && (
        <>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card title="Details" description="Only the school admin can change these.">
                <div className="mb-5 flex items-center gap-4">
                  <Avatar name={name} src={photoUrl(student.photoId)} size="xl" />
                  <div className="text-sm text-fg-2">
                    {student.gender && <p>{student.gender === "MALE" ? "Boy" : student.gender === "FEMALE" ? "Girl" : "Other"}</p>}
                    {student.bloodGroup && (
                      <Badge tone="red">
                        <Droplet className="h-3 w-3" />
                        {BLOOD_GROUP_LABELS[student.bloodGroup]}
                      </Badge>
                    )}
                  </div>
                </div>
                <dl className="grid gap-5 sm:grid-cols-2">
                  <InfoItem icon={CalendarDays} label="Date of birth">
                    {student.dateOfBirth ? dateFormat.format(student.dateOfBirth) : "—"}
                  </InfoItem>
                  <InfoItem icon={CalendarDays} label="Admitted on">
                    {dateFormat.format(student.admissionDate)}
                  </InfoItem>
                  <InfoItem icon={UserRound} label="Father">
                    {student.fatherName ?? "—"}
                    {student.fatherOccupation && <span className="block text-muted">{student.fatherOccupation}</span>}
                  </InfoItem>
                  <InfoItem icon={UserRound} label="Mother">
                    {student.motherName ?? "—"}
                  </InfoItem>
                  <InfoItem icon={Shield} label="Guardian">
                    {student.guardianName ?? "—"}
                    {student.guardianName && student.guardianRelation && <span className="block text-muted">{student.guardianRelation}</span>}
                  </InfoItem>
                  <InfoItem icon={IdCard} label="Aadhaar">
                    {student.aadhaarNumber ? maskDocumentNumber(student.aadhaarNumber) : "—"}
                  </InfoItem>
                  <InfoItem icon={Hash} label="Category / religion">
                    {[student.category?.replace("SC_ST", "SC/ST"), student.religion].filter(Boolean).join(" · ") || "—"}
                  </InfoItem>
                  <InfoItem icon={Users} label="Last school">
                    {student.lastSchoolName ?? "—"}
                  </InfoItem>
                </dl>
              </Card>

              <Card title="Update" description="You can update the photo, contact details, address and roll number.">
                <ClassStudentForm
                  action={updateClassStudent.bind(null, student.id)}
                  student={student}
                  photoUrl={photoUrl(student.photoId)}
                  whatsappSameAsPhone={!!student.whatsappNumber && normalizeIndianMobile(student.phone ?? "") === student.whatsappNumber}
                />
              </Card>
            </div>

            <div className="space-y-6 self-start">
              <AttendanceSummaryCard schoolId={ctx.school.id} studentId={student.id} registerHref="/teacher/attendance/register" />
              <Card title="Subjects" icon={BookOpen} padded={false}>
                {student.subjects.length === 0 ? (
                  <p className="p-6 text-sm text-muted">No subjects allotted.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {student.subjects.map((s) => (
                      <li key={s.subjectId} className="flex items-center justify-between px-6 py-2.5 text-sm">
                        <span className="text-fg">{s.subject.name}</span>
                        <span className="font-mono text-xs text-subtle">{s.subject.code}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <h2 className="mb-4 mt-10 text-lg font-semibold text-fg">Documents</h2>
          <DocumentsPanel ownerKind="student" ownerId={student.id} documents={student.documents} />
        </>
      )}
    </>
  );
}
