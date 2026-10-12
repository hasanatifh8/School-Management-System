import "server-only";
// A student's Performance Analytics Report: the session's published exams and
// class tests, and attendance by month, turned into trends, comparisons with
// the class, strengths, focus areas and suggested actions.
//
// Rules (so the report always agrees with the official report card):
//  - only results published for the student's section count;
//  - every score is a percentage of its paper's maximum marks, so a 20-mark
//    test and an 80-mark exam compare on one scale;
//  - optional papers are left out, as on the report card;
//  - an absent paper is never a 0: it is left out of averages and shown as AB;
//  - class figures leave out absentees, and are hidden for a paper sat by
//    fewer than MIN_PEERS students (they would give away individual marks);
//  - no other student is ever named: "class highest" is a number only.
import { attendancePercent, emptyCounts, isoDate, parseISODate, type AttendanceCounts } from "@/lib/attendance-shared";
import { attendanceWindow, daysOff } from "@/lib/attendance";
import { db } from "@/lib/db";
import { computeResults, loadSheet, type ResultRow, type Sheet } from "@/lib/exam-marks";
import { loadExam, type ExamActor } from "@/lib/exams";
import { gradeFor } from "@/lib/exams-shared";
import { studentExams } from "@/lib/student-profile";

/** Class figures for a paper need at least this many students who sat it. */
export const MIN_PEERS = 3;
/** Points a subject must rise by between exams to count as "most improved". */
const IMPROVED_BY = 5;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type SubjectScore = {
  subjectId: string;
  name: string;
  /** The student's percentage, or null when absent / not sat. */
  percent: number | null;
  absent: boolean;
  classAvg: number | null;
  classHigh: number | null;
};

export type Assessment = {
  id: string;
  name: string;
  /** Short label for chart axes, e.g. "CT 2" or "Half-Yearly". */
  short: string;
  kind: "EXAM" | "TEST";
  date: string;
  percent: number | null;
  grade: string;
  absent: boolean;
  rank: number | null;
  outOf: number;
  classAvg: number | null;
  subjects: SubjectScore[];
};

/** One assessment for the student: their line and the class's figures, per subject. */
function assessmentOf(e: { id: string; name: string; kind: "EXAM" | "TEST" }, sheet: Sheet, rows: ResultRow[], studentId: string, subjectNames: Map<string, string>): Assessment | null {
  const me = rows.find((r) => r.student.id === studentId);
  if (!me || !me.max) return null;
  const counted = sheet.papers.filter((p) => !p.optional && p.subjectId);
  // Per subject: the student's and each classmate's percentage (papers of one subject summed first).
  const bySubject = new Map<string, { mine: { got: number; max: number; absent: boolean } | null; others: Map<string, { got: number; max: number; absent: boolean }> }>();
  for (const p of counted) {
    const s = bySubject.get(p.subjectId!) ?? { mine: null, others: new Map() };
    for (const r of rows) {
      const c = r.cells.find((x) => x.paperId === p.id);
      if (!c || c.kind === "na" || c.kind === "missing") continue;
      const add = { got: c.kind === "marks" ? c.marks : 0, max: p.maxMarks, absent: c.kind === "absent" };
      const target = r.student.id === studentId ? "mine" : null;
      const prev = target ? s.mine : s.others.get(r.student.id);
      const next = prev ? { got: prev.got + add.got, max: prev.max + add.max, absent: prev.absent && add.absent } : add;
      if (target) s.mine = next;
      else s.others.set(r.student.id, next);
    }
    bySubject.set(p.subjectId!, s);
  }
  const subjects: SubjectScore[] = [...bySubject.entries()]
    .filter(([, s]) => s.mine)
    .map(([subjectId, s]) => {
      const mine = s.mine!;
      const all = [...(mine.absent ? [] : [(mine.got / mine.max) * 100]), ...[...s.others.values()].filter((o) => !o.absent).map((o) => (o.got / o.max) * 100)];
      const enough = all.length >= MIN_PEERS;
      return {
        subjectId,
        name: subjectNames.get(subjectId) ?? "Subject",
        percent: mine.absent ? null : (mine.got / mine.max) * 100,
        absent: mine.absent,
        classAvg: enough ? mean(all) : null,
        classHigh: enough ? Math.max(...all) : null,
      };
    });
  const sat = rows.filter((r) => r.max && !r.absent && r.complete);
  return {
    id: e.id,
    name: e.name,
    short: e.name,
    kind: e.kind,
    date: sheet.papers.at(-1)?.date ?? "",
    percent: me.absent ? null : me.percent,
    grade: me.grade,
    absent: me.absent,
    rank: me.rank,
    outOf: sat.length,
    classAvg: sat.length >= MIN_PEERS ? mean(sat.map((r) => r.percent)) : null,
    subjects,
  };
}

/** Short names for chart axes: class tests numbered in date order ("CT 2"), exams without "examination". */
function shortLabels(list: Assessment[]) {
  let test = 0;
  for (const a of list) {
    if (a.kind === "TEST") a.short = `CT ${++test}`;
    else {
      const name = a.name.replace(/\s*(examination|exam)$/i, "").trim() || a.name;
      a.short = name.length > 14 ? `${name.slice(0, 13)}…` : name;
    }
  }
}

export type MonthAttendance = { month: string; percent: number | null; classPercent: number | null; counts: AttendanceCounts };

/** The student's attendance per month of the session so far, beside their section's. */
async function monthlyAttendance(schoolId: string, studentId: string, sectionId: string | null, from: string, to: string) {
  const [records, holidays] = await Promise.all([
    db.attendanceRecord.findMany({
      where: {
        OR: [{ studentId }, ...(sectionId ? [{ day: { sectionId } }] : [])],
        day: { date: { gte: parseISODate(from)!, lte: parseISODate(to)! }, holiday: null },
      },
      select: { studentId: true, status: true, day: { select: { date: true } } },
    }),
    daysOff(schoolId, from, to),
  ]);
  const mine = new Map<string, AttendanceCounts>();
  const cls = new Map<string, AttendanceCounts>();
  for (const r of records) {
    const d = isoDate(r.day.date);
    if (holidays.has(d)) continue;
    const m = d.slice(0, 7);
    const target = r.studentId === studentId ? mine : cls;
    const c = target.get(m) ?? emptyCounts();
    c[r.status]++;
    target.set(m, c);
    // The student is part of their class too.
    if (r.studentId === studentId && sectionId) {
      const k = cls.get(m) ?? emptyCounts();
      k[r.status]++;
      cls.set(m, k);
    }
  }
  const months: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  const total = emptyCounts();
  for (const c of mine.values()) for (const k of Object.keys(total) as (keyof AttendanceCounts)[]) total[k] += c[k];
  // From the first month anything was marked (the start of a session often has none).
  const first = months.findIndex((m) => mine.has(m) || cls.has(m));
  return {
    months: months.slice(Math.max(first, 0)).map((month) => {
      const c = mine.get(month) ?? emptyCounts();
      return { month, counts: c, percent: attendancePercent(c), classPercent: cls.has(month) ? attendancePercent(cls.get(month)!) : null } satisfies MonthAttendance;
    }),
    total,
    percent: attendancePercent(total),
  };
}

export type SubjectRow = {
  subjectId: string;
  name: string;
  /** In the latest exam. */
  exam: number | null;
  examAbsent: boolean;
  classAvg: number | null;
  classHigh: number | null;
  /** Mean of the subject's class-test percentages this session. */
  tests: number | null;
  testCount: number;
  /** Every score in date order (null = absent), for the sparkline. */
  history: { short: string; percent: number | null; kind: "EXAM" | "TEST" }[];
  trend: "up" | "steady" | "down" | null;
  status: "strength" | "on-track" | "focus" | null;
};

/** Everything the report shows, or null if the student is not in this school. */
export async function performanceReport(schoolId: string, studentId: string) {
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    include: { section: { include: { class: true, classTeacher: { select: { firstName: true, middleName: true, lastName: true } } } }, subjects: { select: { subjectId: true } }, enrollments: { select: { sectionId: true } } },
  });
  if (!student) return null;
  const win = await attendanceWindow(schoolId);
  const actor: ExamActor = { kind: "admin", schoolId, who: "" };

  // This session's exams and class tests whose results are published for the student's section.
  const published = (await studentExams(student)).filter((e) => e.session === win.session.name && e.resultPublishedAt);
  const subjectIds = new Set<string>();
  const loaded = await Promise.all(
    published.map(async (e) => {
      const exam = await loadExam(schoolId, e.id);
      const sheet = exam && (await loadSheet(actor, exam, e.sectionId));
      sheet?.papers.forEach((p) => p.subjectId && subjectIds.add(p.subjectId));
      return sheet ? { e, sheet, rows: computeResults(sheet) } : null;
    }),
  );
  const subjectNames = new Map((await db.subject.findMany({ where: { id: { in: [...subjectIds] } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
  const assessments = loaded
    .filter((x) => !!x)
    .map((x) => assessmentOf({ id: x.e.id, name: x.e.name, kind: x.e.kind }, x.sheet, x.rows, studentId, subjectNames))
    .filter((a): a is Assessment => !!a)
    .sort((a, b) => a.date.localeCompare(b.date));
  shortLabels(assessments);

  const exams = assessments.filter((a) => a.kind === "EXAM");
  const tests = assessments.filter((a) => a.kind === "TEST");
  // The report is "as of" the latest exam; with no exam yet, the latest class test.
  const anchor = exams.at(-1) ?? assessments.at(-1) ?? null;
  const previousExam = exams.length > 1 ? exams.at(-2)! : null;

  // Per subject: latest exam against the class, class-test average, trend and status.
  const allSubjects = new Map<string, string>();
  for (const a of assessments) for (const s of a.subjects) allSubjects.set(s.subjectId, s.name);
  const subjects: SubjectRow[] = [...allSubjects.entries()]
    .map(([subjectId, name]) => {
      const inAnchor = anchor?.subjects.find((s) => s.subjectId === subjectId);
      const testScores = tests.map((t) => t.subjects.find((s) => s.subjectId === subjectId)?.percent).filter((p): p is number => p != null);
      const history = assessments.flatMap((a) => {
        const s = a.subjects.find((x) => x.subjectId === subjectId);
        return s ? [{ short: a.short, percent: s.percent, kind: a.kind }] : [];
      });
      const scores = history.map((h) => h.percent).filter((p): p is number => p != null);
      // Trend: the last three scores against the three before (or the halves of a shorter run).
      let trend: SubjectRow["trend"] = null;
      if (scores.length >= 4) {
        const k = Math.min(3, Math.floor(scores.length / 2));
        const diff = mean(scores.slice(-k))! - mean(scores.slice(-2 * k, -k))!;
        trend = diff >= 5 ? "up" : diff <= -5 ? "down" : "steady";
      }
      const exam = inAnchor?.percent ?? null;
      const avg = inAnchor?.classAvg ?? null;
      const status: SubjectRow["status"] =
        exam == null ? null : exam >= 75 && (avg == null || exam >= avg) ? "strength" : exam < 50 || (avg != null && exam <= avg - 10) ? "focus" : "on-track";
      return {
        subjectId,
        name,
        exam,
        examAbsent: !!inAnchor?.absent,
        classAvg: avg,
        classHigh: inAnchor?.classHigh ?? null,
        tests: mean(testScores),
        testCount: testScores.length,
        history,
        trend,
        status,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Most improved: the biggest rise in a subject from the previous exam to the latest one.
  let improved: { name: string; by: number } | null = null;
  if (anchor && previousExam && anchor !== previousExam) {
    for (const s of anchor.subjects) {
      const before = previousExam.subjects.find((x) => x.subjectId === s.subjectId)?.percent;
      if (s.percent == null || before == null) continue;
      const by = s.percent - before;
      if (by >= IMPROVED_BY && (!improved || by > improved.by)) improved = { name: s.name, by };
    }
  }
  const ranked = subjects.filter((s) => s.exam != null).sort((a, b) => b.exam! - a.exam! || (b.tests ?? 0) - (a.tests ?? 0));
  const top = ranked.length >= 2 ? ranked[0] : null;

  const attendance = await monthlyAttendance(schoolId, studentId, student.sectionId, win.min, win.max);
  const testAvg = mean(tests.map((t) => t.percent).filter((p): p is number => p != null));
  const examAvg = mean(exams.map((t) => t.percent).filter((p): p is number => p != null));
  // How steady class-test results are: spread of the scores (standard deviation, in points).
  const testScores = tests.map((t) => t.percent).filter((p): p is number => p != null);
  const spread = testScores.length >= 3 ? Math.sqrt(mean(testScores.map((p) => (p - testAvg!) ** 2))!) : null;

  return {
    student,
    session: win.session,
    asOf: win.max,
    assessments,
    exams,
    tests,
    anchor,
    previousExam,
    subjects,
    top,
    improved,
    attendance,
    testAvg,
    examAvg,
    spread,
    insights: insightsFor({ firstName: student.firstName, anchor, previousExam, subjects, attendance: attendance.percent, testAvg, examAvg, spread }),
  };
}

export type PerformanceReport = NonNullable<Awaited<ReturnType<typeof performanceReport>>>;

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

/** Plain-language findings and suggested actions, built from rules (no guesswork). */
function insightsFor(r: {
  firstName: string;
  anchor: Assessment | null;
  previousExam: Assessment | null;
  subjects: SubjectRow[];
  attendance: number | null;
  testAvg: number | null;
  examAvg: number | null;
  spread: number | null;
}) {
  const { firstName: name, anchor, previousExam, subjects, attendance } = r;
  const strengths = subjects.filter((s) => s.status === "strength").sort((a, b) => b.exam! - a.exam!).slice(0, 3);
  const focus = subjects.filter((s) => s.status === "focus").sort((a, b) => a.exam! - b.exam!).slice(0, 3);

  let summary = "No published results yet this session.";
  if (anchor?.percent != null) {
    const change = previousExam?.percent != null && anchor !== previousExam ? anchor.percent - previousExam.percent : null;
    summary = `${name} scored ${pct(anchor.percent)} (${gradeFor(anchor.percent)}) in ${anchor.name}`;
    if (change != null) summary += Math.abs(change) < 1 ? `, about the same as in ${previousExam!.name}` : `, ${change > 0 ? "up" : "down"} ${Math.abs(Math.round(change * 10) / 10)} points from ${previousExam!.name}`;
    summary += ".";
    if (strengths.length) summary += ` Strongest in ${strengths.map((s) => s.name).join(" and ")}.`;
    if (focus.length) summary += ` ${focus.map((s) => s.name).join(" and ")} ${focus.length === 1 ? "needs" : "need"} more attention.`;
  }

  const notes: string[] = [];
  if (attendance != null) {
    const high = anchor?.percent != null && anchor.classAvg != null && anchor.percent >= anchor.classAvg;
    if (attendance >= 90) notes.push(high ? `Regular attendance (${pct(attendance)}) and results above the class average.` : `Attendance is regular (${pct(attendance)}); results have room to grow with focused revision.`);
    else if (attendance >= 75) notes.push(`Attendance is ${pct(attendance)}. Missed days can leave gaps; aim for 90% or more.`);
    else notes.push(`Attendance is low (${pct(attendance)}), below the 75% most schools expect. Missed lessons are likely affecting results.`);
  }
  if (r.testAvg != null && r.examAvg != null && Math.abs(r.testAvg - r.examAvg) >= 10)
    notes.push(
      r.testAvg > r.examAvg
        ? `Class tests (${pct(r.testAvg)}) go better than exams (${pct(r.examAvg)}): practice under exam conditions and time management may help.`
        : `Exams (${pct(r.examAvg)}) go better than class tests (${pct(r.testAvg)}): regular revision between exams may help.`,
    );
  if (r.spread != null) notes.push(r.spread <= 8 ? "Class-test results are consistent from test to test." : `Class-test results vary a lot (about ±${Math.round(r.spread)} points), so preparation may be uneven.`);
  const down = subjects.filter((s) => s.trend === "down").map((s) => s.name);
  if (down.length) notes.push(`Falling recently: ${down.join(", ")}.`);

  const actions = focus.map((s) =>
    s.classAvg != null && s.exam != null && s.exam < s.classAvg
      ? `${s.name}: revise the basics with the subject teacher; target the class average (${pct(s.classAvg)}) in the next exam.`
      : `${s.name}: extra practice each week; target 50% or more in the next exam.`,
  );
  if (attendance != null && attendance < 90) actions.push("Attendance: aim for 90% or more for the rest of the session.");
  if (!actions.length && strengths.length) actions.push(`Keep up the work in ${strengths.map((s) => s.name).join(", ")}; try stretch problems to go further.`);

  return { summary, strengths, focus, notes, actions: actions.slice(0, 4) };
}
