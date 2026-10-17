import Link from "next/link";
import {
  BookOpenText,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Coffee,
  FileBarChart,
  NotebookPen,
  Plane,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Ring, scoreTone, subjectTone } from "@/components/student-portal/ui";
import { Avatar, Badge, Card, EmptyState, TextLink, cx } from "@/components/ui";
import { attendanceWindow, loadStudentAttendance } from "@/lib/attendance";
import { STATUS_META, addDays, formatISO, greeting, isoDate, nowHHMM, parseISODate, shortDate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { computeResults, loadSheet } from "@/lib/exam-marks";
import { loadExam } from "@/lib/exams";
import { formatExamDate } from "@/lib/exams-shared";
import { personLeave } from "@/lib/leave";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONES } from "@/lib/leave-shared";
import { listMaterials, studentMaterialWhere } from "@/lib/materials";
import { KIND_META } from "@/lib/materials-shared";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import { getPeriods, loadSectionCells } from "@/lib/timetable";
import { formatTime, slotKey } from "@/lib/timetable-shared";
import { loadPortalStudent, portalExams } from "./student-data";

const DAY_MS = 86_400_000;

/** A friendly line about the session's attendance. */
function cheer(percent: number | null, name: string) {
  if (percent == null) return "Your attendance and results will show here as the session goes on.";
  if (percent >= 95) return `Superb attendance this session, ${name}! Keep it up.`;
  if (percent >= 85) return `Great going, ${name}. Every day in class counts.`;
  if (percent >= 75) return "Good effort! A few more days in class will lift your attendance.";
  return "Let's aim to be in class every day: your attendance needs a boost.";
}

/** The student's home: a warm hello, their numbers at a glance, today's classes, and what's new. */
export default async function StudentHomePage() {
  const { student, school, section, full } = await loadPortalStudent();
  const [win, session] = await Promise.all([attendanceWindow(school.id), getCurrentSession(school.id)]);
  const today = win.today;
  const weekday = parseISODate(today)!.getUTCDay() || 7;
  const [attendance, exams, leave, materials, periods, cells, timetableDays] = await Promise.all([
    loadStudentAttendance(school.id, student, win.min, win.max),
    portalExams(full),
    personLeave(school.id, "STUDENT", student.id),
    listMaterials(studentMaterialWhere(school.id, session.id, section)),
    getPeriods(school.id),
    section ? loadSectionCells(section.id) : Promise.resolve({} as Record<string, { title: string; sub?: string }>),
    db.school.findUniqueOrThrow({ where: { id: school.id }, select: { timetableDays: true } }).then((s) => s.timetableDays),
  ]);

  // Latest published result: this student's line, and each paper's score.
  const latest = exams.find((e) => e.resultPublishedAt);
  let result: { percent: number; grade: string; rank: number | null; outOf: number; papers: { name: string; percent: number }[] } | null = null;
  if (latest) {
    const loaded = await loadExam(school.id, latest.id);
    const sheet = loaded && (await loadSheet({ kind: "admin", schoolId: school.id, who: "" }, loaded, latest.sectionId));
    const row = sheet ? computeResults(sheet).find((r) => r.student.id === student.id) : undefined;
    if (sheet && row) {
      result = {
        percent: row.percent,
        grade: row.grade,
        rank: row.rank,
        outOf: sheet.students.length,
        papers: row.cells.flatMap((c) => {
          if (c.kind !== "marks") return [];
          const p = sheet.papers.find((x) => x.id === c.paperId)!;
          return [{ name: p.name, percent: (c.marks / p.maxMarks) * 100 }];
        }),
      };
    }
  }

  // Next paper: the first one on or after today.
  const nextPaper = exams
    .flatMap((e) => e.papers.map((p) => ({ ...p, exam: e.name })))
    .filter((p) => p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
  const daysTo = nextPaper ? Math.round((parseISODate(nextPaper.date)!.getTime() - parseISODate(today)!.getTime()) / DAY_MS) : null;

  const dueSoon = materials
    .filter((m) => m.kind === "ASSIGNMENT" && m.dueDate && isoDate(m.dueDate) >= today)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const weekAgo = parseISODate(addDays(today, -7))!.getTime();
  const fresh = materials.filter((m) => m.createdAt.getTime() >= weekAgo);

  // Today: attendance mark, and the class's periods (none on a weekly off or holiday).
  const mark = attendance.marks[today];
  const holiday = attendance.holidays.get(today);
  const schoolDay = !holiday && timetableDays.includes(weekday);
  const lessons = schoolDay ? periods.map((p) => ({ ...p, cell: cells[slotKey(weekday, p.id)] })).filter((p) => p.isBreak || p.cell) : [];
  const now = nowHHMM();

  const quick: { href: string; label: string; icon: LucideIcon; tone: string }[] = [
    { href: "/student/leave", label: "Apply for leave", icon: Plane, tone: "from-sky-500 to-indigo-500" },
    { href: "/student/results", label: "Report card", icon: Trophy, tone: "from-amber-400 to-orange-500" },
    { href: "/student/materials", label: "Study material", icon: BookOpenText, tone: "from-emerald-500 to-teal-500" },
    { href: "/student/timetable", label: "Timetable", icon: CalendarClock, tone: "from-fuchsia-500 to-violet-500" },
  ];

  return (
    <>
      {/* Hello */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-lift sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 right-40 h-48 w-48 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-6 h-2 w-2 rounded-full bg-white/50" />
        <span aria-hidden className="pointer-events-none absolute left-[60%] top-16 h-1.5 w-1.5 rounded-full bg-white/40" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="rounded-full bg-white/20 p-1 ring-2 ring-white/40">
            <Avatar name={fullName(student)} src={photoUrl(student.photoId)} size="xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              <Sparkles className="h-4 w-4" aria-hidden /> {greeting()}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{student.firstName}!</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">{section ? sectionLabel(section) : "No class yet"}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">Roll {student.rollNumber ?? "—"}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 font-mono ring-1 ring-white/25">{student.studentCode}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">Session {session.name}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm ring-1 ring-white/25 backdrop-blur">
            <p className="text-xs text-white/75">Today</p>
            <p className="font-semibold">{holiday ? `Holiday · ${holiday}` : mark ? STATUS_META[mark as keyof typeof STATUS_META]?.label ?? mark : schoolDay ? "Not marked yet" : "No school today"}</p>
          </div>
        </div>
        <p className="relative mt-5 max-w-2xl text-sm text-white/90">{cheer(attendance.percent, student.firstName)}</p>
      </section>

      {/* At a glance */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/student/attendance" className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
          <Ring value={attendance.percent} sub="present" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">Attendance</p>
            <p className="text-xs text-muted">{attendance.days ? `${attendance.days} school days this session` : "Nothing marked yet"}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text">
              See calendar <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </p>
          </div>
        </Link>
        <Link href="/student/results" className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
          <Ring value={result?.percent ?? null} sub={result ? `grade ${result.grade}` : "result"} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">Latest result</p>
            <p className="truncate text-xs text-muted">{latest && result ? latest.name : "No results published yet"}</p>
            {result?.rank && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                <Trophy className="h-3.5 w-3.5" /> Rank {result.rank} of {result.outOf}
              </p>
            )}
          </div>
        </Link>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 p-5 text-white shadow-card">
          <ClipboardList className="absolute -right-3 -top-3 h-20 w-20 text-white/10" aria-hidden />
          <p className="text-sm font-semibold text-white/85">Next exam</p>
          {nextPaper ? (
            <>
              <p className="mt-1 text-3xl font-bold tabular-nums">{daysTo === 0 ? "Today" : daysTo === 1 ? "Tomorrow" : `${daysTo} days`}</p>
              <p className="mt-1 truncate text-sm font-medium">{nextPaper.name}</p>
              <p className="truncate text-xs text-white/75">
                {nextPaper.exam} · {formatExamDate(nextPaper.date)} · {formatTime(nextPaper.startTime)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-white/85">No exams coming up. Enjoy learning!</p>
          )}
        </div>
        <Link href="/student/materials?kind=ASSIGNMENT" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-rose-500 p-5 text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
          <NotebookPen className="absolute -right-3 -top-3 h-20 w-20 text-white/15" aria-hidden />
          <p className="text-sm font-semibold text-white/85">Assignments due</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{dueSoon.length}</p>
          <p className="mt-1 truncate text-sm">{dueSoon[0] ? `Next: ${dueSoon[0].title}` : "All caught up!"}</p>
          {dueSoon[0] && <p className="text-xs text-white/80">Due {formatISO(isoDate(dueSoon[0].dueDate!), shortDate)}</p>}
        </Link>
      </div>

      <div className="mb-6 grid items-start gap-6 xl:grid-cols-3">
        {/* Today's classes */}
        <Card title="Today's classes" icon={CalendarClock} className="xl:col-span-2" action={<TextLink href="/student/timetable">Full timetable</TextLink>}>
          {!section ? (
            <p className="text-sm text-muted">You haven&apos;t been placed in a class yet.</p>
          ) : !schoolDay ? (
            <EmptyState compact icon={Coffee} title={holiday ? `Holiday: ${holiday}` : "No school today"} description="Rest well and see you next school day." />
          ) : lessons.length === 0 ? (
            <p className="text-sm text-muted">Your class timetable isn&apos;t set up yet.</p>
          ) : (
            <ol className="relative space-y-2 border-l-2 border-dashed border-line pl-5">
              {lessons.map((p) => {
                const live = now >= p.startTime && now < p.endTime;
                const done = now >= p.endTime;
                const tone = subjectTone(p.cell?.title);
                return (
                  <li key={p.id} className="relative">
                    <span
                      aria-hidden
                      className={cx("absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-surface", live ? "bg-accent animate-pulse" : done ? "bg-line-strong" : p.isBreak ? "bg-amber-400" : tone.bar)}
                    />
                    {p.isBreak ? (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                        <Coffee className="h-3.5 w-3.5" /> {p.name} · {formatTime(p.startTime)}
                      </div>
                    ) : (
                      <div className={cx("flex items-center gap-3 rounded-xl bg-gradient-to-r to-transparent px-3 py-2.5 ring-1", tone.soft, tone.ring, live && "ring-2 ring-accent", done && "opacity-60")}>
                        <span className="w-16 shrink-0 text-xs tabular-nums text-muted">{formatTime(p.startTime)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-fg">{p.cell!.title}</span>
                          {p.cell!.sub && <span className="block truncate text-xs text-muted">{p.cell!.sub}</span>}
                        </span>
                        {live && (
                          <Badge tone="indigo" dot>
                            Now
                          </Badge>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Quick actions */}
        <section className="grid grid-cols-2 gap-3">
          {quick.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={cx("group flex aspect-[4/3] flex-col justify-between rounded-3xl bg-gradient-to-br p-4 text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift", q.tone)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
                <q.icon className="h-5 w-5" />
              </span>
              <span className="flex items-center justify-between text-sm font-semibold">
                {q.label}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      </div>

      <div className="mb-6 grid items-start gap-6 xl:grid-cols-3">
        {/* Subjects in the latest result */}
        <Card title="How I did" icon={FileBarChart} description={latest && result ? latest.name : undefined} className="xl:col-span-2" action={<TextLink href="/student/results">Report card</TextLink>}>
          {!result || !result.papers.length ? (
            <EmptyState compact icon={FileBarChart} title="No results yet" description="Your subject scores show here once a result is published." />
          ) : (
            <ul className="space-y-3">
              {result.papers.map((p) => {
                const tone = subjectTone(p.name.split(" (")[0]);
                return (
                  <li key={p.name}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", tone.chip)}>{p.name}</span>
                      <span className={cx("font-semibold tabular-nums", scoreTone(p.percent))}>{Math.round(p.percent)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                      <div className={cx("h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, p.percent)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Leave */}
        <Card title="My leave" icon={Plane} padded={false} action={<TextLink href="/student/leave">Apply</TextLink>}>
          {leave.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No leave requests yet. Need a day off? Apply in a minute.</p>
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
      </div>

      {/* New study material */}
      <Card title="New from your teachers" icon={BookOpenText} description={fresh.length ? `${fresh.length} new this week` : undefined} action={<TextLink href="/student/materials">All material</TextLink>}>
        {materials.length === 0 ? (
          <EmptyState compact icon={BookOpenText} title="Nothing posted yet" description="Notes, assignments and test papers from your teachers appear here." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {materials.slice(0, 6).map((m) => {
              const tone = subjectTone(m.subject?.name);
              const href = m.fileId ? `/api/materials/${m.id}` : (m.link ?? "/student/materials");
              return (
                <li key={m.id}>
                  <a href={href} target={m.fileId || m.link ? "_blank" : undefined} rel="noopener noreferrer" className={cx("flex h-full flex-col rounded-2xl bg-gradient-to-br to-transparent p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-card", tone.soft, tone.ring)}>
                    <span className="flex items-center gap-2">
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone.chip)}>{m.subject?.name ?? "General"}</span>
                      <Badge tone={KIND_META[m.kind].badge}>{KIND_META[m.kind].label}</Badge>
                    </span>
                    <span className="mt-2 line-clamp-2 text-sm font-semibold text-fg">{m.title}</span>
                    <span className="mt-auto pt-2 text-xs text-muted">
                      {m.dueDate ? `Due ${formatISO(isoDate(m.dueDate), shortDate)}` : formatISO(isoDate(m.createdAt), shortDate)}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <CalendarCheck className="h-3.5 w-3.5" /> Attendance and results are updated by your school.
      </p>
    </>
  );
}

