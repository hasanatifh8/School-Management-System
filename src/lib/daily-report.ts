import "server-only";
// The school's day at a glance ("Today's report"): attendance by class and for
// staff, money in and out, academics, leave, people and everything logged.
import { attendanceWindow, weeklyOffOn } from "@/lib/attendance";
import { addDays, emptyCounts, isoDate, parseISODate } from "@/lib/attendance-shared";
import { dayRoster } from "@/lib/attendance-day";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { formatTime } from "@/lib/timetable-shared";

const clock24 = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" });
/** "10:31 pm" in India, worked out here so the browser shows the same text. */
const clock = (d: Date) => formatTime(clock24.format(d));

/** The instant a day starts in India, and the next day's start. */
function istRange(date: string) {
  const from = new Date(`${date}T00:00:00+05:30`);
  return { gte: from, lt: new Date(from.getTime() + 86_400_000) };
}

export type ClassRow = {
  sectionId: string;
  label: string;
  classOrder: number;
  teacher: { name: string; phone: string | null } | null;
  strength: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  marked: number;
  /** "taken", "not-taken", or "holiday" (the class was given a holiday that day). */
  status: "taken" | "not-taken" | "holiday";
  holiday: string | null;
  percent: number | null;
  markedBy: string | null;
  /** When it was last saved, e.g. "10:31 am". */
  markedAt: string | null;
};

export async function loadDailyReport(schoolId: string, date: string) {
  const d = parseISODate(date)!;
  const created = istRange(date);
  const tomorrow = addDays(date, 1);
  const win = await attendanceWindow(schoolId);

  const [
    weeklyOff,
    holiday,
    sections,
    days,
    students,
    teaching,
    nonTeaching,
    receipts,
    cancelled,
    expenses,
    salaries,
    papers,
    tomorrowPapers,
    results,
    notices,
    materials,
    admissions,
    leaveNew,
    leaveDecided,
    proxies,
    activity,
    events,
    tomorrowHoliday,
    birthdayStudents,
    birthdayTeachers,
  ] = await Promise.all([
    weeklyOffOn(schoolId, date),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId, date: d } } }),
    db.section.findMany({
      where: { class: { schoolId } },
      orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
      include: {
        class: true,
        classTeacher: { select: { firstName: true, middleName: true, lastName: true, phone: true, whatsappNumber: true } },
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
      },
    }),
    db.attendanceDay.findMany({
      where: { schoolId, date: d },
      select: {
        sectionId: true,
        holiday: true,
        markedBy: true,
        updatedAt: true,
        records: { where: { student: { status: "ACTIVE" } }, select: { status: true } },
      },
    }),
    dayRoster(schoolId, "students", date),
    dayRoster(schoolId, "teaching", date),
    dayRoster(schoolId, "non-teaching", date),
    db.feeReceipt.findMany({
      where: { schoolId, date: d, cancelledAt: null, waiver: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        studentId: true,
        studentName: true,
        className: true,
        total: true,
        mode: true,
        collectedBy: true,
        createdAt: true,
        reference: true,
      },
    }),
    db.feeReceipt.findMany({
      where: { schoolId, cancelledAt: created },
      select: { id: true, number: true, studentName: true, total: true, cancelledBy: true, cancelReason: true },
    }),
    db.expense.findMany({ where: { schoolId, date: d }, orderBy: { createdAt: "desc" }, include: { category: { select: { name: true } } } }),
    db.salaryPayment.findMany({ where: { schoolId, paidOn: d }, select: { id: true, name: true, role: true, amount: true, month: true, mode: true } }),
    db.examPaper.findMany({
      where: { date: d, exam: { schoolId, OR: [{ kind: "TEST" }, { published: true }] } },
      orderBy: { startTime: "asc" },
      include: {
        exam: { select: { id: true, name: true, kind: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
        section: { include: { class: true } },
      },
    }),
    db.examPaper.count({ where: { date: parseISODate(tomorrow)!, exam: { schoolId, OR: [{ kind: "TEST" }, { published: true }] } } }),
    db.examResult.findMany({
      where: { exam: { schoolId }, publishedAt: created },
      include: { exam: { select: { id: true, name: true } }, section: { include: { class: true } } },
    }),
    db.notice.findMany({
      where: { schoolId, createdAt: created },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, audience: true, sentBy: true, channels: true, createdAt: true },
    }),
    db.studyMaterial.findMany({
      where: { schoolId, createdAt: created },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        kind: true,
        uploadedBy: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
      },
    }),
    db.student.findMany({
      where: { schoolId, createdAt: created },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, section: { include: { class: true } } },
    }),
    db.leaveRequest.findMany({
      where: { schoolId, createdAt: created },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        applicant: true,
        status: true,
        category: true,
        fromDate: true,
        toDate: true,
        student: { select: { firstName: true, middleName: true, lastName: true } },
        teacher: { select: { firstName: true, middleName: true, lastName: true } },
        staff: { select: { name: true } },
      },
    }),
    db.leaveRequest.count({ where: { schoolId, decidedAt: created } }),
    db.proxyAssignment.count({ where: { schoolId, date: d } }),
    db.auditLog.findMany({
      where: { schoolId, createdAt: created },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, action: true, actor: true, category: true, createdAt: true },
    }),
    db.calendarEvent.findMany({
      where: { schoolId, startDate: { lte: parseISODate(tomorrow)! }, endDate: { gte: d } },
      orderBy: { startDate: "asc" },
      select: { id: true, title: true, type: true, startDate: true, endDate: true },
    }),
    db.holiday.findUnique({ where: { schoolId_date: { schoolId, date: parseISODate(tomorrow)! } } }).then(async (h) => h?.name ?? (await weeklyOffOn(schoolId, tomorrow))),
    db.student.findMany({
      where: { schoolId, status: "ACTIVE", dateOfBirth: { not: null } },
      select: { id: true, firstName: true, middleName: true, lastName: true, dateOfBirth: true, section: { include: { class: true } } },
    }),
    db.teacher.findMany({
      where: { schoolId, status: "ACTIVE", dateOfBirth: { not: null } },
      select: { id: true, firstName: true, middleName: true, lastName: true, dateOfBirth: true },
    }),
  ]);

  const offName = holiday?.name ?? weeklyOff;
  const isFuture = date > win.today;

  /* ── Classes ── */
  const byDay = new Map(days.map((x) => [x.sectionId, x]));
  const classes: ClassRow[] = sections.map((s) => {
    const day = byDay.get(s.id);
    const c = emptyCounts();
    for (const r of day?.records ?? []) c[r.status]++;
    const marked = day && !day.holiday ? day.records.length : 0;
    const attended = c.PRESENT + c.LATE + c.HALF_DAY;
    const counted = attended + c.ABSENT;
    return {
      sectionId: s.id,
      label: sectionLabel(s),
      classOrder: s.class.sortOrder,
      teacher: s.classTeacher ? { name: fullName(s.classTeacher), phone: s.classTeacher.whatsappNumber ?? s.classTeacher.phone } : null,
      strength: s._count.students,
      present: attended,
      absent: c.ABSENT,
      late: c.LATE,
      halfDay: c.HALF_DAY,
      leave: c.LEAVE,
      marked,
      status: day?.holiday ? "holiday" : marked ? "taken" : "not-taken",
      holiday: day?.holiday ?? null,
      percent: counted ? Math.round(((c.PRESENT + c.LATE + c.HALF_DAY / 2) / counted) * 1000) / 10 : null,
      markedBy: day?.markedBy ?? null,
      markedAt: day && marked ? clock(day.updatedAt) : null,
    };
  });
  const withStudents = classes.filter((c) => c.strength > 0);

  /* ── Money ── */
  const feeTotal = receipts.reduce((n, r) => n + r.total, 0);
  const byMode = new Map<string, number>();
  const byCollector = new Map<string, { amount: number; count: number }>();
  for (const r of receipts) {
    byMode.set(r.mode, (byMode.get(r.mode) ?? 0) + r.total);
    const c = byCollector.get(r.collectedBy) ?? { amount: 0, count: 0 };
    byCollector.set(r.collectedBy, { amount: c.amount + r.total, count: c.count + 1 });
  }
  const expenseTotal = expenses.reduce((n, e) => n + e.amount, 0);
  const salaryTotal = salaries.reduce((n, s) => n + s.amount, 0);

  /* ── Birthdays today ── */
  const md = date.slice(5);
  const born = (dob: Date | null) => !!dob && isoDate(dob).slice(5) === md;

  return {
    date,
    today: win.today,
    min: win.min,
    max: win.today > win.max ? win.today : win.max,
    isToday: date === win.today,
    isFuture,
    offName,
    weeklyOff: !holiday && !!weeklyOff,
    classes,
    attendance: {
      sections: withStudents.length,
      taken: withStudents.filter((c) => c.status === "taken").length,
      notTaken: withStudents.filter((c) => c.status === "not-taken").length,
      classHolidays: withStudents.filter((c) => c.status === "holiday").length,
    },
    students,
    teaching,
    nonTeaching,
    fees: {
      total: feeTotal,
      count: receipts.length,
      receipts: receipts.map((r) => ({ ...r, createdAt: clock(r.createdAt) })),
      byMode: [...byMode].map(([mode, amount]) => ({ mode, amount })).sort((a, b) => b.amount - a.amount),
      byCollector: [...byCollector].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
      cancelled,
    },
    expenses: {
      total: expenseTotal,
      list: expenses.map((e) => ({ id: e.id, category: e.category.name, amount: e.amount, paidTo: e.paidTo, description: e.description, mode: e.mode })),
    },
    salaries: { total: salaryTotal, list: salaries },
    papers: papers.map((p) => ({
      id: p.id,
      examId: p.exam.id,
      exam: p.exam.name,
      kind: p.exam.kind,
      name: p.title ?? p.subject?.name ?? "Paper",
      classes: p.section ? sectionLabel(p.section) : (p.class?.name ?? "All classes"),
      startTime: p.startTime,
      endTime: p.endTime,
    })),
    results: results.map((r) => ({
      key: `${r.examId}-${r.sectionId}`,
      examId: r.examId,
      exam: r.exam.name,
      section: sectionLabel(r.section),
      sectionId: r.sectionId,
      by: r.publishedBy,
    })),
    notices: notices.map((n) => ({ ...n, createdAt: clock(n.createdAt) })),
    materials: materials.map((m) => ({
      id: m.id,
      title: m.title,
      kind: m.kind,
      by: m.uploadedBy,
      where: [m.class.name, m.section?.name].filter(Boolean).join(" – "),
      subject: m.subject?.name ?? null,
    })),
    admissions: admissions.map((s) => ({ id: s.id, name: fullName(s), code: s.studentCode, section: s.section ? sectionLabel(s.section) : "No class yet" })),
    leave: {
      submitted: leaveNew.map((l) => ({
        id: l.id,
        applicant: l.applicant,
        status: l.status,
        category: l.category,
        from: isoDate(l.fromDate),
        to: isoDate(l.toDate),
        name: l.student ? fullName(l.student) : l.teacher ? fullName(l.teacher) : (l.staff?.name ?? "—"),
      })),
      decided: leaveDecided,
    },
    proxies,
    activity: activity.map((a) => ({ ...a, createdAt: clock(a.createdAt) })),
    events: events.map((e) => ({ id: e.id, title: e.title, type: e.type, start: isoDate(e.startDate), end: isoDate(e.endDate) })),
    /** The next day: closed (holiday or weekly off) with its name, and exam papers on it. */
    tomorrow: { date: tomorrow, holiday: tomorrowHoliday ?? null, papers: tomorrowPapers },
    birthdays: [
      ...birthdayStudents
        .filter((s) => born(s.dateOfBirth))
        .map((s) => ({ id: s.id, name: fullName(s), sub: s.section ? sectionLabel(s.section) : "Student", href: `/admin/students/${s.id}` })),
      ...birthdayTeachers.filter((t) => born(t.dateOfBirth)).map((t) => ({ id: t.id, name: fullName(t), sub: "Teacher", href: `/admin/teachers/${t.id}` })),
    ],
  };
}

export type DailyReport = Awaited<ReturnType<typeof loadDailyReport>>;
