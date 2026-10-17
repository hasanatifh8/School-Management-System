import Link from "next/link";
import { BookOpenText, CalendarCheck, ClipboardList, FileBarChart, Hourglass, Plane } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatCard, StatGrid, TextLink } from "@/components/ui";
import { attendanceWindow, loadStudentAttendance } from "@/lib/attendance";
import { addDays, formatISO, parseISODate, shortDate } from "@/lib/attendance-shared";
import { computeResults, loadSheet } from "@/lib/exam-marks";
import { loadExam } from "@/lib/exams";
import { dateSpan } from "@/lib/exams-shared";
import { personLeave } from "@/lib/leave";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONES } from "@/lib/leave-shared";
import { listMaterials, studentMaterialWhere } from "@/lib/materials";
import { KIND_META } from "@/lib/materials-shared";
import { sectionLabel } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import { loadPortalStudent, portalExams } from "./student-data";

const posted = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** The student's home: attendance, latest result, leave and new study material at a glance. */
export default async function StudentHomePage() {
  const { student, school, section, full } = await loadPortalStudent();
  const [win, session] = await Promise.all([attendanceWindow(school.id), getCurrentSession(school.id)]);
  const [attendance, exams, leave, materials] = await Promise.all([
    loadStudentAttendance(school.id, student, win.min, win.max),
    portalExams(full),
    personLeave(school.id, "STUDENT", student.id),
    listMaterials(studentMaterialWhere(school.id, session.id, section)),
  ]);
  // The latest published result: this student's line of it.
  const latest = exams.find((e) => e.resultPublishedAt);
  let latestRow: { percent: number; grade: string; result: string } | null = null;
  if (latest) {
    const loaded = await loadExam(school.id, latest.id);
    const sheet = loaded && (await loadSheet({ kind: "admin", schoolId: school.id, who: "" }, loaded, latest.sectionId));
    const row = sheet ? computeResults(sheet).find((r) => r.student.id === student.id) : undefined;
    if (row) latestRow = { percent: row.percent, grade: row.grade, result: row.result };
  }
  const upcoming = exams.filter((e) => e.status === "upcoming" || e.status === "ongoing").slice(0, 3);
  const pending = leave.filter((r) => r.status === "PENDING").length;
  const weekAgo = parseISODate(addDays(win.today, -7))!.getTime();
  const fresh = materials.filter((m) => m.createdAt.getTime() >= weekAgo).length;

  return (
    <>
      <PageHeader
        title={`Hello, ${student.firstName}`}
        subtitle={`${section ? sectionLabel(section) : "No class yet"} · Roll ${student.rollNumber ?? "—"} · ${student.studentCode} · Session ${session.name}`}
      />
      <div className="mb-6">
        <StatGrid>
          <StatCard
            icon={CalendarCheck}
            tone={attendance.percent == null ? "slate" : attendance.percent >= 90 ? "emerald" : attendance.percent >= 75 ? "amber" : "rose"}
            label="Attendance"
            value={attendance.percent == null ? "—" : `${attendance.percent}%`}
            detail={attendance.days ? `${attendance.days} school days this session` : "Nothing marked yet"}
            href="/student/attendance"
          />
          <StatCard
            icon={FileBarChart}
            tone="indigo"
            label="Latest result"
            value={latestRow ? `${latestRow.percent.toFixed(1)}%` : "—"}
            detail={latest && latestRow ? `${latest.name} · Grade ${latestRow.grade}` : "No results published yet"}
            href="/student/results"
          />
          <StatCard icon={Hourglass} tone={pending ? "amber" : "emerald"} label="Leave waiting" value={pending} detail={pending ? "Waiting for your class teacher" : "Nothing waiting"} href="/student/leave" />
          <StatCard icon={BookOpenText} tone="violet" label="Study material" value={materials.length} detail={fresh ? `${fresh} new this week` : "From your teachers"} href="/student/materials" />
        </StatGrid>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card title="New study material" icon={BookOpenText} padded={false} className="xl:col-span-2" action={<TextLink href="/student/materials">All material</TextLink>}>
          {materials.length === 0 ? (
            <EmptyState compact icon={BookOpenText} title="Nothing posted yet" description="Notes and assignments from your teachers appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {materials.slice(0, 6).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Badge tone={KIND_META[m.kind].badge}>{KIND_META[m.kind].label}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{m.title}</p>
                    <p className="text-xs text-muted">
                      {m.subject?.name ?? "General"} · {posted.format(m.createdAt)}
                      {m.dueDate && ` · due ${formatISO(m.dueDate.toISOString().slice(0, 10), shortDate)}`}
                    </p>
                  </div>
                  {m.fileId ? (
                    <a href={`/api/materials/${m.id}`} target="_blank" rel="noopener" className="text-sm font-medium text-accent-text hover:underline">
                      Open
                    </a>
                  ) : m.link ? (
                    <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent-text hover:underline">
                      Open link
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Exams & tests" icon={ClipboardList} padded={false} action={<TextLink href="/student/results?tab=exams">Date sheets</TextLink>}>
            {upcoming.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No exams coming up.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-fg">
                      {e.name}
                      {e.status === "ongoing" && (
                        <Badge tone="amber" dot>
                          On now
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {e.papers.length ? dateSpan(e.papers.map((p) => p.date)) : "Dates not set"} · {e.papers.length} paper{e.papers.length === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="My leave" icon={Plane} padded={false} action={<TextLink href="/student/leave">Apply</TextLink>}>
            {leave.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No leave requests yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {leave.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <span className="block font-medium text-fg">{r.from === r.to ? formatISO(r.from, shortDate) : `${formatISO(r.from, shortDate)} – ${formatISO(r.to, shortDate)}`}</span>
                      <span className="block text-xs text-muted">{CATEGORY_LABELS[r.category]}</span>
                    </span>
                    <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="text-center text-xs text-muted">
            Something wrong in your details?{" "}
            <Link href="/student/account" className="font-medium text-accent-text hover:underline">
              See your account
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
