import "server-only";
// Read-only data tools for the admin assistant. The model picks a tool and its
// arguments; the code here runs the query. Every query is limited to the
// signed-in admin's school, and nothing here writes data, so the model can't
// reach another school or change anything, whatever it asks for.
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { attendancePercent, emptyCounts, isoDate, parseISODate, type AttendanceCounts } from "@/lib/attendance-shared";
import { attendanceTotals, loadClassSummaries, schoolHolidays, studentAttendanceSummary } from "@/lib/attendance";
import { db } from "@/lib/db";
import { computeResults, loadSheet } from "@/lib/exam-marks";
import { loadExam } from "@/lib/exams";
import { paperName } from "@/lib/exams-shared";
import { isMonth, monthBounds, monthSummary } from "@/lib/expenses";
import { getFeesAccess, loadStudentAccount, outstandingByStudent } from "@/lib/fees";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import type { ToolSpec } from "./llm";

type Ctx = { schoolId: string; today: string };

/* ───────────────────────── Argument helpers ───────────────────────── */

// Models often send null or "" for arguments they don't use.
const blank = (v: unknown) => (v === null || v === "" ? undefined : v);
const text = z.preprocess(blank, z.string().trim().max(200).optional());
const date = z.preprocess(blank, z.string().refine((v) => !!parseISODate(v), "Use YYYY-MM-DD").optional());
const month = z.preprocess(blank, z.string().refine(isMonth, "Use YYYY-MM").optional());
const limit = (def: number, max: number) => z.preprocess(blank, z.coerce.number().int().min(1).max(max).default(def));

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const CLASS_ARG = str('Class name, e.g. "Class 5", "5" or "5A" (optional)');
const SECTION_ARG = str('Section, e.g. "A" (optional)');

const rows = <T>(list: T[], max: number) => ({ shown: Math.min(list.length, max), total: list.length, rows: list.slice(0, max) });
const d = (x: Date | null | undefined) => (x ? isoDate(x) : null);

/* ───────────────────────── Finding classes, students ───────────────────────── */

const normClass = (s: string) =>
  s.toLowerCase().replace(/\b(class|grade|std|standard)\b\.?/g, "").replace(/[\s.\-–]+/g, " ").trim();

/**
 * Sections matching loose class/section text ("5", "Class 5", "5A", "V-B").
 * `sections` is null when neither was given (no filter).
 */
async function findSections(schoolId: string, cls?: string, section?: string) {
  if (!cls && !section) return { sections: null };
  const all = await db.section.findMany({
    where: { class: { schoolId } },
    orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
    include: { class: true },
  });
  const byClass = (c: string) => {
    const n = normClass(c);
    const exact = all.filter((s) => normClass(s.class.name) === n);
    return exact.length ? exact : all.filter((s) => normClass(s.class.name).includes(n));
  };
  let matches = all;
  let sec = section?.trim().toLowerCase();
  if (cls) {
    matches = byClass(cls);
    // "5A" / "Class 5 - B": the last letter may be the section.
    const split = cls.trim().match(/^(.*?)[\s\-–]*([A-Za-z])$/);
    if (!matches.length && split && !sec) {
      matches = byClass(split[1]);
      sec = split[2].toLowerCase();
    }
  }
  if (sec) matches = matches.filter((s) => s.name.toLowerCase() === sec);
  if (!matches.length) {
    return { error: `No class/section matches "${[cls, section].filter(Boolean).join(" ")}".`, available: all.map(sectionLabel) };
  }
  return { sections: matches };
}

/** Name words must each match part of the name or the student ID (or phone for digits). */
function studentNameWhere(q: string): Prisma.StudentWhereInput[] {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({
      OR: [
        { firstName: { contains: w, mode: "insensitive" } },
        { middleName: { contains: w, mode: "insensitive" } },
        { lastName: { contains: w, mode: "insensitive" } },
        { studentCode: { contains: w, mode: "insensitive" } },
        ...(/^\d{4,}$/.test(w) ? [{ phone: { contains: w } }, { whatsappNumber: { contains: w } }] : []),
      ],
    }));
}

const GENDERS: Record<string, "MALE" | "FEMALE" | "OTHER"> = { male: "MALE", boy: "MALE", boys: "MALE", m: "MALE", female: "FEMALE", girl: "FEMALE", girls: "FEMALE", f: "FEMALE", other: "OTHER" };
const bloodGroup = (v: string) => v.toUpperCase().replace(/\s/g, "").replace(/\+$/, "_POS").replace(/-$/, "_NEG").replace(/(POS|NEG)ITIVE$/, "$1");
const CATEGORIES = { general: "GENERAL", obc: "OBC", sc: "SC_ST", st: "SC_ST", sc_st: "SC_ST", "sc/st": "SC_ST", minority: "MINORITY" } as const;

const pretty = (v: string | null | undefined) => (v ? v.replace(/_POS$/, "+").replace(/_NEG$/, "-").replace(/_/g, " ").toLowerCase() : null);

/* ───────────────────────── Tools ───────────────────────── */

type Tool = { spec: ToolSpec; run: (ctx: Ctx, raw: unknown) => Promise<unknown> };

function tool<S extends z.ZodType>(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  schema: S,
  run: (ctx: Ctx, args: z.infer<S>) => Promise<unknown>,
): Tool {
  return {
    spec: { type: "function", function: { name, description, parameters: { type: "object", properties } } },
    run: async (ctx, raw) => {
      const parsed = schema.safeParse(raw ?? {});
      if (!parsed.success) return { error: "Invalid arguments", issues: z.flattenError(parsed.error).fieldErrors };
      return run(ctx, parsed.data);
    },
  };
}

const TOOLS: Tool[] = [
  tool(
    "school_overview",
    "Headline numbers: current session, counts of active students (by gender), teachers, staff, classes, sections and houses.",
    {},
    z.object({}),
    async ({ schoolId, today }) => {
      const [session, school, students, unplaced, teachers, staff, classes, sections, houses] = await Promise.all([
        getCurrentSession(schoolId),
        db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, board: true, principalName: true, address: true, phone: true, email: true } }),
        db.student.groupBy({ by: ["gender"], where: { schoolId, status: "ACTIVE" }, _count: true }),
        db.student.count({ where: { schoolId, status: "ACTIVE", sectionId: null } }),
        db.teacher.count({ where: { schoolId, status: "ACTIVE" } }),
        db.staffMember.count({ where: { schoolId, status: "ACTIVE" } }),
        db.schoolClass.count({ where: { schoolId } }),
        db.section.count({ where: { class: { schoolId } } }),
        db.house.count({ where: { schoolId } }),
      ]);
      return {
        school,
        today,
        session: { name: session.name, start: d(session.startDate), end: d(session.endDate) },
        activeStudents: students.reduce((n, g) => n + g._count, 0),
        studentsByGender: Object.fromEntries(students.map((g) => [pretty(g.gender) ?? "not set", g._count])),
        studentsWithoutClass: unplaced,
        activeTeachers: teachers,
        activeNonTeachingStaff: staff,
        classes,
        sections,
        houses,
      };
    },
  ),

  tool(
    "list_classes",
    "Every class section with its class teacher and number of active students (boys/girls).",
    {},
    z.object({}),
    async ({ schoolId }) => {
      const sections = await db.section.findMany({
        where: { class: { schoolId } },
        orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
        include: {
          class: true,
          classTeacher: { select: { firstName: true, middleName: true, lastName: true } },
          students: { where: { status: "ACTIVE" }, select: { gender: true } },
        },
      });
      return sections.map((s) => ({
        section: sectionLabel(s),
        classTeacher: s.classTeacher ? fullName(s.classTeacher) : null,
        students: s.students.length,
        boys: s.students.filter((x) => x.gender === "MALE").length,
        girls: s.students.filter((x) => x.gender === "FEMALE").length,
      }));
    },
  ),

  tool(
    "search_students",
    "Find and count students by name/ID, class, section, gender, house, category, blood group, admission dates or birthday month. Returns the total and a list.",
    {
      name: str("Part of the name, student ID or phone (optional)"),
      class: CLASS_ARG,
      section: SECTION_ARG,
      gender: str("male or female (optional)"),
      house: str("House name (optional)"),
      category: str("general, obc, sc_st or minority (optional)"),
      blood_group: str('e.g. "B+" (optional)'),
      status: { type: "string", enum: ["ACTIVE", "INACTIVE", "ALL"], description: "Default ACTIVE (current students)" },
      admitted_from: str("YYYY-MM-DD (optional)"),
      admitted_to: str("YYYY-MM-DD (optional)"),
      birthday_month: num("1–12: students born in this month (optional)"),
      limit: num("Max students to list, default 30, max 100"),
    },
    z.object({
      name: text,
      class: text,
      section: text,
      gender: text,
      house: text,
      category: text,
      blood_group: text,
      status: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : blank(v)), z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ACTIVE")),
      admitted_from: date,
      admitted_to: date,
      birthday_month: z.preprocess(blank, z.coerce.number().int().min(1).max(12).optional()),
      limit: limit(30, 100),
    }),
    async ({ schoolId }, a) => {
      const found = await findSections(schoolId, a.class, a.section);
      if ("error" in found) return found;
      const where: Prisma.StudentWhereInput = { schoolId };
      if (a.status !== "ALL") where.status = a.status;
      if (found.sections) where.sectionId = { in: found.sections.map((s) => s.id) };
      if (a.name) where.AND = studentNameWhere(a.name);
      if (a.gender) {
        const g = GENDERS[a.gender.toLowerCase()];
        if (!g) return { error: "gender must be male, female or other" };
        where.gender = g;
      }
      if (a.house) where.house = { name: { contains: a.house, mode: "insensitive" } };
      if (a.category) {
        const c = CATEGORIES[a.category.toLowerCase() as keyof typeof CATEGORIES];
        if (!c) return { error: "category must be general, obc, sc_st or minority" };
        where.category = c;
      }
      if (a.blood_group) {
        const b = bloodGroup(a.blood_group);
        if (!["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"].includes(b)) return { error: "Unknown blood group" };
        where.bloodGroup = b as Prisma.StudentWhereInput["bloodGroup"];
      }
      if (a.admitted_from || a.admitted_to) {
        where.admissionDate = {
          ...(a.admitted_from ? { gte: parseISODate(a.admitted_from)! } : {}),
          ...(a.admitted_to ? { lt: new Date(parseISODate(a.admitted_to)!.getTime() + 86_400_000) } : {}),
        };
      }
      let list = await db.student.findMany({
        where,
        orderBy: [{ section: { class: { sortOrder: "asc" } } }, { section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
        include: { section: { include: { class: true } }, house: { select: { name: true } } },
      });
      if (a.birthday_month) list = list.filter((s) => s.dateOfBirth && s.dateOfBirth.getUTCMonth() + 1 === a.birthday_month);
      return rows(
        list.map((s) => ({
          name: fullName(s),
          studentId: s.studentCode,
          class: s.section ? sectionLabel(s.section) : null,
          roll: s.rollNumber,
          gender: pretty(s.gender),
          dateOfBirth: d(s.dateOfBirth),
          father: s.fatherName,
          mother: s.motherName,
          phone: s.phone ?? s.whatsappNumber,
          house: s.house?.name ?? null,
          admitted: d(s.admissionDate),
          ...(a.status !== "ACTIVE" ? { status: s.status } : {}),
        })),
        a.limit,
      );
    },
  ),

  tool(
    "student_profile",
    "Everything about one student: details, parents, contact, attendance this session, fee dues and payments, and exam marks.",
    { student: str("Student name or student ID, e.g. STU-2026-0001") },
    z.object({ student: z.string().trim().min(1).max(200) }),
    async ({ schoolId }, { student: q }) => {
      const byCode = await db.student.findFirst({ where: { schoolId, studentCode: { equals: q, mode: "insensitive" } }, select: { id: true } });
      const matches = byCode
        ? []
        : await db.student.findMany({
            where: { schoolId, AND: studentNameWhere(q) },
            orderBy: [{ status: "asc" }, { firstName: "asc" }],
            take: 20,
            select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, status: true, section: { include: { class: true } } },
          });
      if (!byCode && !matches.length) return { error: `No student matches "${q}".` };
      if (matches.length > 1) {
        return {
          multipleMatches: matches.map((s) => ({ name: fullName(s), studentId: s.studentCode, class: s.section ? sectionLabel(s.section) : null, status: s.status })),
          note: "Ask which student, or call again with the student ID.",
        };
      }
      const id = byCode?.id ?? matches[0].id;
      const [account, attendance, marks] = await Promise.all([
        loadStudentAccount(schoolId, id),
        studentAttendanceSummary(schoolId, id),
        db.examMark.findMany({
          where: { studentId: id, paper: { exam: { schoolId } } },
          include: { paper: { include: { subject: { select: { name: true } }, exam: { select: { name: true, createdAt: true, session: { select: { name: true } } } } } } },
          orderBy: { paper: { date: "asc" } },
        }),
      ]);
      if (!account) return { error: "Student not found." };
      const s = account.student;
      const house = s.houseId ? await db.house.findUnique({ where: { id: s.houseId }, select: { name: true } }) : null;
      const exams = new Map<string, { exam: string; session: string; papers: { paper: string; marks: string; max: number | null }[] }>();
      for (const m of marks) {
        const key = m.paper.examId;
        if (!exams.has(key)) exams.set(key, { exam: m.paper.exam.name, session: m.paper.exam.session.name, papers: [] });
        exams.get(key)!.papers.push({ paper: paperName(m.paper.subject?.name, m.paper.title), marks: m.absent ? "absent" : String(m.marks ?? "—"), max: m.paper.maxMarks });
      }
      return {
        name: fullName(s),
        studentId: s.studentCode,
        status: s.status,
        class: s.section ? sectionLabel(s.section) : null,
        roll: s.rollNumber,
        gender: pretty(s.gender),
        dateOfBirth: d(s.dateOfBirth),
        bloodGroup: pretty(s.bloodGroup),
        category: pretty(s.category),
        religion: s.religion,
        house: house?.name ?? null,
        admitted: d(s.admissionDate),
        father: s.fatherName,
        fatherOccupation: s.fatherOccupation,
        mother: s.motherName,
        guardian: s.guardianName ? `${s.guardianName}${s.guardianRelation ? ` (${s.guardianRelation})` : ""}` : null,
        phone: s.phone,
        whatsapp: s.whatsappNumber,
        email: s.email,
        address: s.primaryAddress,
        previousSchool: s.lastSchoolName,
        attendance: { session: attendance.session.name, percent: attendance.percent, days: attendance.counts },
        fees: {
          session: account.session.name,
          totalForSession: account.totals.total,
          paid: account.totals.paid,
          dueNow: account.totals.dueNow,
          upcoming: account.totals.upcoming,
          unpaidInstalments: account.dues
            .filter((i) => i.status === "OVERDUE" || i.status === "PARTIAL")
            .map((i) => ({ fee: i.headName, period: i.label, dueDate: i.due, balance: i.balance })),
          recentReceipts: account.receipts.slice(0, 5).map((r) => ({ number: r.number, date: d(r.date), amount: r.total, mode: r.mode, cancelled: !!r.cancelledAt })),
        },
        exams: [...exams.values()],
      };
    },
  ),

  tool(
    "search_teachers",
    "Find teachers by name or subject; shows contact, qualification, salary, class-teacher section and the subjects/sections they teach.",
    {
      name: str("Part of the teacher's name or employee ID (optional)"),
      subject: str("Subject they teach, e.g. Maths (optional)"),
      status: { type: "string", enum: ["ACTIVE", "INACTIVE", "ALL"], description: "Default ACTIVE" },
    },
    z.object({
      name: text,
      subject: text,
      status: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : blank(v)), z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ACTIVE")),
    }),
    async ({ schoolId }, a) => {
      const where: Prisma.TeacherWhereInput = { schoolId };
      if (a.status !== "ALL") where.status = a.status;
      if (a.name) {
        where.AND = a.name.split(/\s+/).map((w) => ({
          OR: [
            { firstName: { contains: w, mode: "insensitive" } },
            { middleName: { contains: w, mode: "insensitive" } },
            { lastName: { contains: w, mode: "insensitive" } },
            { employeeCode: { contains: w, mode: "insensitive" } },
          ],
        }));
      }
      const subjectMatch = a.subject
        ? { OR: [{ name: { contains: a.subject, mode: "insensitive" as const } }, { code: { equals: a.subject, mode: "insensitive" as const } }] }
        : undefined;
      if (subjectMatch) {
        where.OR = [{ subjectAssignments: { some: { subject: subjectMatch } } }, { specialization: { contains: a.subject, mode: "insensitive" } }];
      }
      const teachers = await db.teacher.findMany({
        where,
        orderBy: { firstName: "asc" },
        include: {
          classTeacherOf: { include: { class: true } },
          subjectAssignments: { include: { subject: { select: { name: true } }, section: { include: { class: true } } } },
        },
      });
      return rows(
        teachers.map((t) => ({
          name: fullName(t),
          employeeId: t.employeeCode,
          ...(a.status !== "ACTIVE" ? { status: t.status } : {}),
          phone: t.phone ?? t.whatsappNumber,
          email: t.email,
          qualification: t.qualification,
          specialization: t.specialization,
          experienceYears: t.experienceYears,
          monthlySalary: t.monthlySalary,
          joined: d(t.joiningDate),
          classTeacherOf: t.classTeacherOf ? sectionLabel(t.classTeacherOf) : null,
          teaches: t.subjectAssignments.map((s) => `${s.subject.name} (${sectionLabel(s.section)})`),
        })),
        60,
      );
    },
  ),

  tool(
    "list_staff",
    "Non-teaching staff (office, guards, drivers…) with job, staff ID, qualification, phone, salary and whether they are a cashier (can collect fees).",
    { name: str("Part of the name or designation (optional)") },
    z.object({ name: text }),
    async ({ schoolId }, a) => {
      const staff = await db.staffMember.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
          ...(a.name ? { OR: [{ name: { contains: a.name, mode: "insensitive" } }, { designation: { contains: a.name, mode: "insensitive" } }] } : {}),
        },
        orderBy: { name: "asc" },
        include: { cashierAccount: { select: { active: true } } },
      });
      return rows(
        staff.map((s) => ({
          name: s.name,
          staffId: s.employeeCode,
          job: s.designation,
          qualification: s.qualification,
          experienceYears: s.experienceYears,
          phone: s.phone ?? s.whatsappNumber,
          email: s.email,
          monthlySalary: s.monthlySalary,
          joined: d(s.joiningDate),
          cashier: s.cashierAccount ? (s.cashierAccount.active ? "yes" : "yes, sign-in turned off") : "no",
        })),
        60,
      );
    },
  ),

  tool(
    "attendance_on_date",
    "Attendance for one day: per section whether it was marked and present/absent counts, plus the list of absent students. Defaults to today.",
    { date: str("YYYY-MM-DD, default today"), class: CLASS_ARG, section: SECTION_ARG },
    z.object({ date, class: text, section: text }),
    async ({ schoolId, today }, a) => {
      const day = a.date ?? today;
      const found = await findSections(schoolId, a.class, a.section);
      if ("error" in found) return found;
      const sectionIds = found.sections?.map((s) => s.id);
      const [holiday, sections, days] = await Promise.all([
        db.holiday.findUnique({ where: { schoolId_date: { schoolId, date: parseISODate(day)! } } }),
        db.section.findMany({
          where: { class: { schoolId }, ...(sectionIds ? { id: { in: sectionIds } } : {}) },
          orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
          include: { class: true },
        }),
        db.attendanceDay.findMany({
          where: { schoolId, date: parseISODate(day)!, ...(sectionIds ? { sectionId: { in: sectionIds } } : {}) },
          include: {
            records: {
              include: { student: { select: { firstName: true, middleName: true, lastName: true, studentCode: true, rollNumber: true, phone: true, whatsappNumber: true } } },
            },
          },
        }),
      ]);
      if (holiday) return { date: day, schoolHoliday: holiday.name };
      const bySection = new Map(days.map((x) => [x.sectionId, x]));
      const absent: unknown[] = [];
      const total = emptyCounts();
      const perSection = sections.map((s) => {
        const dayRow = bySection.get(s.id);
        if (dayRow?.holiday) return { section: sectionLabel(s), holiday: dayRow.holiday };
        if (!dayRow?.records.length) return { section: sectionLabel(s), marked: false };
        const c = emptyCounts();
        for (const r of dayRow.records) {
          c[r.status]++;
          total[r.status]++;
          if (r.status === "ABSENT" || r.status === "LEAVE") {
            absent.push({ name: fullName(r.student), studentId: r.student.studentCode, class: sectionLabel(s), roll: r.student.rollNumber, status: r.status.toLowerCase(), phone: r.student.phone ?? r.student.whatsappNumber, remark: r.remark });
          }
        }
        return { section: sectionLabel(s), marked: true, ...c, percent: attendancePercent(c) };
      });
      return {
        date: day,
        schoolTotals: { ...total, percent: attendancePercent(total) },
        sectionsNotMarked: perSection.filter((s) => "marked" in s && !s.marked).map((s) => s.section),
        sections: perSection,
        absentOrOnLeave: rows(absent, 150),
      };
    },
  ),

  tool(
    "attendance_report",
    "Attendance over a date range: each section's working days, average % and absences; and students whose attendance is below a threshold. Defaults to the session so far.",
    {
      from: str("YYYY-MM-DD, default session start"),
      to: str("YYYY-MM-DD, default today"),
      class: CLASS_ARG,
      section: SECTION_ARG,
      below_percent: num("List students with attendance below this %, default 75"),
    },
    z.object({ from: date, to: date, class: text, section: text, below_percent: z.preprocess(blank, z.coerce.number().min(1).max(100).default(75)) }),
    async ({ schoolId, today }, a) => {
      const session = await getCurrentSession(schoolId);
      const from = a.from ?? isoDate(session.startDate);
      const to = a.to ?? today;
      if (from > to) return { error: "from is after to" };
      const found = await findSections(schoolId, a.class, a.section);
      if ("error" in found) return found;
      const ids = found.sections ? new Set(found.sections.map((s) => s.id)) : null;
      const summaries = (await loadClassSummaries(schoolId, from, to)).filter((s) => !ids || ids.has(s.id));
      const students = await db.student.findMany({
        where: { schoolId, status: "ACTIVE", sectionId: { in: summaries.map((s) => s.id) } },
        select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, rollNumber: true, phone: true, section: { include: { class: true } } },
      });
      const totals = await attendanceTotals(schoolId, students.map((s) => s.id), from, to);
      const low = students
        .map((s) => ({ s, c: totals.get(s.id) ?? emptyCounts() }))
        .map(({ s, c }) => ({ s, c, p: attendancePercent(c) }))
        .filter((x): x is { s: (typeof students)[number]; c: AttendanceCounts; p: number } => x.p != null && x.p < a.below_percent)
        .sort((x, y) => x.p - y.p)
        .map(({ s, c, p }) => ({ name: fullName(s), studentId: s.studentCode, class: s.section ? sectionLabel(s.section) : null, percent: p, absent: c.ABSENT, phone: s.phone }));
      return {
        from,
        to,
        sections: summaries.map(({ label, classTeacher, students, workingDays, average, below75, absences }) => ({ section: label, classTeacher, students, workingDays, averagePercent: average, studentsBelow75: below75, absences })),
        [`studentsBelow${a.below_percent}Percent`]: rows(low, 100),
      };
    },
  ),

  tool(
    "fee_dues",
    "Pending fees in the current session: total outstanding and the students who owe the most (amount due up to today). Optional class filter.",
    { class: CLASS_ARG, section: SECTION_ARG, min_amount: num("Only students owing at least this many rupees (optional)"), limit: num("Max students to list, default 30, max 150") },
    z.object({ class: text, section: text, min_amount: z.preprocess(blank, z.coerce.number().min(0).default(1)), limit: limit(30, 150) }),
    async ({ schoolId }, a) => {
      const found = await findSections(schoolId, a.class, a.section);
      if ("error" in found) return found;
      const where: Prisma.StudentWhereInput = found.sections ? { sectionId: { in: found.sections.map((s) => s.id) } } : {};
      const [{ session }, dues, students] = await Promise.all([
        getFeesAccess(),
        outstandingByStudent(schoolId, where),
        db.student.findMany({
          where: { ...where, schoolId, status: "ACTIVE", sectionId: { not: null } },
          select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, fatherName: true, phone: true, whatsappNumber: true, section: { include: { class: true } } },
        }),
      ]);
      let totalDue = 0;
      let totalPaid = 0;
      let charged = 0;
      for (const v of dues.values()) {
        totalDue += v.dueNow;
        totalPaid += v.paid;
        charged += v.total;
      }
      const owing = students
        .map((s) => ({ s, t: dues.get(s.id) }))
        .filter((x) => x.t && x.t.dueNow >= a.min_amount)
        .sort((x, y) => y.t!.dueNow - x.t!.dueNow)
        .map(({ s, t }) => ({ name: fullName(s), studentId: s.studentCode, class: s.section ? sectionLabel(s.section) : null, father: s.fatherName, phone: s.phone ?? s.whatsappNumber, dueNow: t!.dueNow, paidThisSession: t!.paid }));
      return {
        session: session.name,
        totalOutstandingNow: totalDue,
        totalCollectedThisSession: totalPaid,
        totalChargedForWholeSession: charged,
        studentsWithDues: owing.length,
        students: rows(owing, a.limit),
      };
    },
  ),

  tool(
    "fee_collection",
    "Fees collected (receipts) between two dates: total, number of receipts, split by payment mode and by fee head, daily totals, and the latest receipts. Defaults to today.",
    { from: str("YYYY-MM-DD, default today"), to: str("YYYY-MM-DD, default same as from"), class: CLASS_ARG },
    z.object({ from: date, to: date, class: text }),
    async ({ schoolId, today }, a) => {
      const from = a.from ?? today;
      const to = a.to ?? from;
      if (from > to) return { error: "from is after to" };
      const receipts = await db.feeReceipt.findMany({
        where: {
          schoolId,
          cancelledAt: null,
          date: { gte: parseISODate(from)!, lte: parseISODate(to)! },
          ...(a.class ? { className: { contains: a.class, mode: "insensitive" } } : {}),
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { items: { select: { headName: true, amount: true } } },
      });
      const sumBy = (key: (r: (typeof receipts)[number]) => string) => {
        const m: Record<string, number> = {};
        for (const r of receipts) m[key(r)] = (m[key(r)] ?? 0) + r.total;
        return m;
      };
      const byHead: Record<string, number> = {};
      for (const r of receipts) for (const i of r.items) byHead[i.headName] = (byHead[i.headName] ?? 0) + i.amount;
      return {
        from,
        to,
        total: receipts.reduce((n, r) => n + r.total, 0),
        receipts: receipts.length,
        byMode: sumBy((r) => r.mode),
        byFeeHead: byHead,
        byDay: sumBy((r) => isoDate(r.date)),
        latest: receipts.slice(0, 25).map((r) => ({ number: r.number, date: isoDate(r.date), student: r.studentName, class: r.className, amount: r.total, mode: r.mode, collectedBy: r.collectedBy })),
      };
    },
  ),

  tool(
    "expenses_report",
    "Spending for a month: by category with budget and forecast, salaries paid/still due, fees collected that month, and the largest expenses.",
    { month: str("YYYY-MM, default this month") },
    z.object({ month }),
    async ({ schoolId, today }, a) => {
      const m = a.month ?? today.slice(0, 7);
      const s = await monthSummary(schoolId, m, today);
      const { from, to } = monthBounds(m);
      const top = await db.expense.findMany({
        where: { schoolId, date: { gte: from, lte: to } },
        orderBy: { amount: "desc" },
        take: 15,
        include: { category: { select: { name: true } } },
      });
      return {
        month: m,
        totals: { spent: s.totals.spent, budget: s.totals.budget, forecastForMonth: s.totals.forecast, forecastNextMonth: s.totals.next, teachingSalariesPaid: s.totals.teaching, nonTeachingSalariesPaid: s.totals.nonTeaching },
        feesCollected: s.feesCollected,
        categories: s.rows.map((r) => ({ category: r.name, spent: r.spent, budget: r.budget, usualMonthly: r.average, forecast: r.forecast })),
        salariesStillToPay: { total: s.salaryDue, people: s.unpaid.map((r) => ({ name: r.name, role: r.role, salary: r.salary })) },
        largestExpenses: top.map((e) => ({ date: isoDate(e.date), category: e.category.name, amount: e.amount, paidTo: e.paidTo, description: e.description })),
      };
    },
  ),

  tool(
    "list_exams",
    "Exams and class tests in the current session: dates, classes, and which sections have results published.",
    {},
    z.object({}),
    async ({ schoolId }) => {
      const session = await getCurrentSession(schoolId);
      const exams = await db.exam.findMany({
        where: { schoolId, sessionId: session.id },
        orderBy: { createdAt: "asc" },
        include: {
          sections: { include: { section: { include: { class: true } } } },
          papers: { select: { date: true } },
          results: { include: { section: { include: { class: true } } } },
          teacher: { select: { firstName: true, middleName: true, lastName: true } },
        },
      });
      return exams.map((e) => {
        const dates = e.papers.map((p) => isoDate(p.date)).sort();
        return {
          name: e.name,
          kind: e.kind === "EXAM" ? "exam" : "class test",
          createdBy: e.teacher ? fullName(e.teacher) : e.createdBy,
          published: e.kind === "EXAM" ? e.published : undefined,
          from: dates[0] ?? null,
          to: dates.at(-1) ?? null,
          papers: e.papers.length,
          sections: e.sections.map((s) => sectionLabel(s.section)),
          resultsPublishedFor: e.results.map((r) => sectionLabel(r.section)),
        };
      });
    },
  ),

  tool(
    "exam_results",
    "Results of an exam: per section pass/fail counts, average and toppers; with a class/section or student, each student's total, %, grade, rank and failed papers.",
    { exam: str("Exam name, e.g. Half-yearly"), class: CLASS_ARG, section: SECTION_ARG, student: str("Student name or ID (optional)") },
    z.object({ exam: z.string().trim().min(1).max(200), class: text, section: text, student: text }),
    async ({ schoolId }, a) => {
      const session = await getCurrentSession(schoolId);
      const candidates = await db.exam.findMany({
        where: { schoolId, name: { contains: a.exam, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, sessionId: true },
      });
      const current = candidates.filter((c) => c.sessionId === session.id);
      const pick = current.length ? current : candidates;
      if (!pick.length) {
        const all = await db.exam.findMany({ where: { schoolId, sessionId: session.id }, select: { name: true } });
        return { error: `No exam matches "${a.exam}".`, examsThisSession: all.map((e) => e.name) };
      }
      if (pick.length > 1 && !pick.some((p) => p.name.toLowerCase() === a.exam.toLowerCase())) {
        return { multipleMatches: pick.map((p) => p.name), note: "Ask which exam." };
      }
      const chosen = pick.find((p) => p.name.toLowerCase() === a.exam.toLowerCase()) ?? pick[0];
      const exam = (await loadExam(schoolId, chosen.id))!;
      const found = await findSections(schoolId, a.class, a.section);
      if ("error" in found) return found;
      const wanted = found.sections ? new Set(found.sections.map((s) => s.id)) : null;
      const sections = exam.sections.filter((s) => !wanted || wanted.has(s.sectionId));
      if (!sections.length) return { error: "This exam isn't for that class.", examSections: exam.sections.map((s) => sectionLabel(s.section)) };

      const actor = { kind: "admin" as const, schoolId, who: "Assistant" };
      const studentWords = a.student?.toLowerCase().split(/\s+/).filter(Boolean);
      const detailed = !!(wanted || studentWords);
      const out = [];
      for (const { sectionId } of sections) {
        const sheet = await loadSheet(actor, exam, sectionId);
        if (!sheet) continue;
        if (!sheet.papers.length) {
          out.push({ section: sheet.section.label, note: "No papers with marks in this exam yet." });
          continue;
        }
        const results = computeResults(sheet);
        const complete = results.filter((r) => r.complete && r.max);
        const summary = {
          section: sheet.section.label,
          published: !!sheet.published,
          students: results.length,
          pass: results.filter((r) => r.result === "Pass").length,
          fail: results.filter((r) => r.result === "Fail").length,
          incomplete: results.filter((r) => r.result === "Incomplete").length,
          averagePercent: complete.length ? Math.round((complete.reduce((n, r) => n + r.percent, 0) / complete.length) * 10) / 10 : null,
          toppers: complete
            .filter((r) => r.rank != null && r.rank <= 3)
            .sort((x, y) => x.rank! - y.rank!)
            .map((r) => ({ rank: r.rank, name: r.student.name, percent: Math.round(r.percent * 10) / 10 })),
        };
        if (!detailed) {
          out.push(summary);
          continue;
        }
        const list = results
          .filter((r) => !studentWords || studentWords.every((w) => r.student.name.toLowerCase().includes(w) || r.student.studentCode.toLowerCase() === w))
          .map((r) => ({
            name: r.student.name,
            roll: r.student.rollNumber,
            obtained: r.obtained,
            max: r.max,
            percent: Math.round(r.percent * 10) / 10,
            grade: r.grade,
            result: r.result,
            rank: r.rank,
            failedIn: r.failed,
            marks: Object.fromEntries(
              sheet.papers.map((p, i) => {
                const c = r.cells[i];
                return [p.name, c.kind === "marks" ? `${c.marks}/${p.maxMarks}` : c.kind];
              }),
            ),
          }));
        if (studentWords && !list.length) continue;
        out.push({ ...summary, results: list });
      }
      return { exam: exam.name, session: exam.session.name, sections: out };
    },
  ),

  tool(
    "calendar",
    "School calendar events (holidays, exams, PTMs, sports, activities) and holidays between two dates. Defaults to the next 30 days.",
    { from: str("YYYY-MM-DD, default today"), to: str("YYYY-MM-DD, default 30 days after from") },
    z.object({ from: date, to: date }),
    async ({ schoolId, today }, a) => {
      const from = a.from ?? today;
      const to = a.to ?? isoDate(new Date(parseISODate(from)!.getTime() + 30 * 86_400_000));
      const [events, holidays, classes] = await Promise.all([
        db.calendarEvent.findMany({
          where: { schoolId, startDate: { lte: parseISODate(to)! }, endDate: { gte: parseISODate(from)! } },
          orderBy: { startDate: "asc" },
        }),
        schoolHolidays(schoolId, from, to),
        db.schoolClass.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      ]);
      const className = new Map(classes.map((c) => [c.id, c.name]));
      return {
        from,
        to,
        events: events.map((e) => ({
          title: e.title,
          type: e.type.toLowerCase(),
          start: isoDate(e.startDate),
          end: isoDate(e.endDate),
          for: e.classIds.length ? e.classIds.map((id) => className.get(id) ?? "?").join(", ") : "whole school",
          published: e.published,
          description: e.description,
        })),
        holidays: [...holidays.values()].map((h) => ({ date: isoDate(h.date), name: h.name })),
      };
    },
  ),

  tool(
    "timetable",
    "Weekly timetable of a class section, or a teacher's schedule. Optionally for one weekday.",
    { class: CLASS_ARG, section: SECTION_ARG, teacher: str("Teacher name (instead of a class)"), day: str("Weekday, e.g. Monday (optional)") },
    z.object({ class: text, section: text, teacher: text, day: text }),
    async ({ schoolId }, a) => {
      const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      let dayNo: number | undefined;
      if (a.day) {
        const i = DAYS.findIndex((x) => x.toLowerCase().startsWith(a.day!.toLowerCase().slice(0, 3)));
        if (i < 0) return { error: "day must be a weekday name" };
        dayNo = i + 1;
      }
      const where: Prisma.TimetableSlotWhereInput = { section: { class: { schoolId } }, ...(dayNo ? { day: dayNo } : {}) };
      if (a.teacher) {
        where.teacher = { AND: a.teacher.split(/\s+/).map((w) => ({ OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }] })) };
      } else {
        if (!a.class) return { error: "Give a class (and section) or a teacher." };
        const found = await findSections(schoolId, a.class, a.section);
        if ("error" in found) return found;
        where.sectionId = { in: found.sections!.map((s) => s.id) };
      }
      const slots = await db.timetableSlot.findMany({
        where,
        orderBy: [{ day: "asc" }, { period: { sortOrder: "asc" } }],
        include: {
          period: true,
          subject: { select: { name: true } },
          teacher: { select: { firstName: true, middleName: true, lastName: true } },
          section: { include: { class: true } },
        },
      });
      if (!slots.length) return { note: "No timetable entries found." };
      return rows(
        slots.map((s) => ({
          day: DAYS[s.day - 1],
          period: s.period.name,
          time: `${s.period.startTime}–${s.period.endTime}`,
          section: sectionLabel(s.section),
          subject: s.subject?.name ?? s.label,
          teacher: s.teacher ? fullName(s.teacher) : null,
        })),
        200,
      );
    },
  ),
];

export const TOOL_SPECS = TOOLS.map((t) => t.spec);
const BY_NAME = new Map(TOOLS.map((t) => [t.spec.function.name, t]));

/** Runs a tool the model asked for and returns its result as JSON text for the model. */
export async function runTool(ctx: Ctx, name: string, args: string) {
  const t = BY_NAME.get(name);
  let result: unknown;
  if (!t) result = { error: `Unknown tool "${name}".` };
  else {
    let parsed: unknown = {};
    try {
      parsed = args.trim() ? JSON.parse(args) : {};
    } catch {
      result = { error: "Arguments were not valid JSON." };
    }
    if (result === undefined) {
      try {
        result = await t.run(ctx, parsed);
      } catch (e) {
        console.error(`Assistant tool ${name} failed`, e);
        result = { error: "The query failed." };
      }
    }
  }
  const json = JSON.stringify(result);
  // Keep tool output within what small models can read.
  return json.length > 12_000 ? `${json.slice(0, 12_000)}… [truncated: ask for a narrower filter]` : json;
}
