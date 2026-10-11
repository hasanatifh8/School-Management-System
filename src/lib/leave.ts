import "server-only";
// Leave requests for students, teachers and staff.
//
// Who may do what:
//  - school admins: enter a request for anyone, and approve or reject any request;
//  - a teacher: apply for their own leave, and enter, approve or reject
//    requests for students of the section they are class teacher of.
// Approving a request turns "Absent" already marked in the leave dates into
// "Leave" (for a student, any mark already saved); attendance taken later
// starts those people on leave. A student's approved leave days are locked to
// "Leave" in the attendance sheet; only school admins / Power Admin can change them.
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { type ActionState, validationError } from "@/lib/action-state";
import { datesBetween, isSunday, isoDate, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { INLINE_TYPES, readDocumentUpload } from "@/lib/documents";
import {
  APPLICANT_LABELS,
  LEAVE_APPLICANTS,
  LEAVE_CATEGORIES,
  LEAVE_STATUSES,
  MAX_LEAVE_DAYS,
  leaveDays,
  CLASH_SHARE,
  LEAVE_URGENT_HOURS,
  staffDepartment,
  teacherDepartment,
  type LeaveApplicantKey,
  type LeaveCategoryKey,
  type LeavePerson,
  type LeaveStatusKey,
} from "@/lib/leave-shared";
import { paginate } from "@/lib/pagination";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSession } from "@/lib/sessions";
import type { TeacherContext } from "@/lib/teacher-auth";

export type LeaveActor =
  | { kind: "admin"; schoolId: string; who: string }
  | { kind: "teacher"; schoolId: string; who: string; ctx: TeacherContext };

export function teacherLeaveActor(ctx: TeacherContext): LeaveActor {
  return { kind: "teacher", schoolId: ctx.school.id, who: fullName(ctx.teacher), ctx };
}

/* ───────────────────────── Visibility ───────────────────────── */

/** Requests the actor can see: everything for admins; for a teacher, their own and their class's students'. */
function visibleWhere(actor: LeaveActor): Prisma.LeaveRequestWhereInput {
  if (actor.kind === "admin") return { schoolId: actor.schoolId };
  const { ctx } = actor;
  return {
    schoolId: actor.schoolId,
    OR: [
      { teacherId: ctx.teacher.id },
      ...(ctx.classSections.length ? [{ applicant: "STUDENT" as const, student: { sectionId: { in: ctx.classSections.map((s) => s.id) } } }] : []),
    ],
  };
}

/** Whether the actor may approve or reject this request. Nobody decides their own. */
function canDecide(actor: LeaveActor, r: { applicant: LeaveApplicantKey; teacherId: string | null; student: { sectionId: string | null } | null }) {
  if (actor.kind === "admin") return true;
  return r.applicant === "STUDENT" && actor.ctx.isClassTeacherOf(r.student?.sectionId);
}

const include = {
  student: { select: { id: true, firstName: true, middleName: true, lastName: true, sectionId: true, section: { include: { class: true } } } },
  teacher: { select: { id: true, firstName: true, middleName: true, lastName: true, employeeCode: true, specialization: true } },
  staff: { select: { id: true, name: true, designation: true, employeeCode: true, department: true } },
  attachment: { select: { fileName: true, mimeType: true, size: true } },
} satisfies Prisma.LeaveRequestInclude;

type Row = Prisma.LeaveRequestGetPayload<{ include: typeof include }>;

function view(actor: LeaveActor, r: Row) {
  const person =
    r.applicant === "STUDENT" && r.student
      ? { name: fullName(r.student), sub: r.student.section ? sectionLabel(r.student.section) : "No class", href: `/students/${r.student.id}` }
      : r.applicant === "TEACHER" && r.teacher
        ? { name: fullName(r.teacher), sub: `Teacher · ${r.teacher.employeeCode}`, href: `/teachers/${r.teacher.id}` }
        : r.staff
          ? { name: r.staff.name, sub: `${r.staff.designation} · ${r.staff.employeeCode}`, href: `/staff/${r.staff.id}` }
          : { name: "Removed", sub: "", href: null };
  const from = isoDate(r.fromDate);
  const to = isoDate(r.toDate);
  return {
    id: r.id,
    applicant: r.applicant,
    personId: (r.studentId ?? r.teacherId ?? r.staffId)!,
    person,
    from,
    to,
    days: leaveDays(from, to),
    category: r.category,
    description: r.description,
    status: r.status,
    requestedBy: r.requestedBy,
    createdAt: r.createdAt.toISOString(),
    decidedBy: r.decidedBy,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decisionNote: r.decisionNote,
    canDecide: r.status === "PENDING" && canDecide(actor, r),
    /** Hours a pending request has been waiting (null once decided). */
    waitingHours: r.status === "PENDING" ? Math.floor((Date.now() - r.createdAt.getTime()) / 3_600_000) : null,
    attachment: r.attachment ? { fileName: r.attachment.fileName, mimeType: r.attachment.mimeType, size: r.attachment.size } : null,
    /** Department for teachers (specialisation) and staff, for clash checks. */
    department: r.teacher ? teacherDepartment(r.teacher) : r.staff ? staffDepartment(r.staff) : null,
    /** Admins can delete any request; a teacher can withdraw their own while it is pending. */
    canWithdraw: actor.kind === "admin" || (r.status === "PENDING" && actor.kind === "teacher" && r.teacherId === actor.ctx.teacher.id),
    mine: actor.kind === "teacher" && r.teacherId === actor.ctx.teacher.id,
  };
}

export type LeaveView = ReturnType<typeof view>;

/** ?status=pending|approved|rejected|all and ?who=student|teacher|staff|mine from the URL. */
export function leaveFilters(params: Record<string, string | string[] | undefined>) {
  const s = typeof params.status === "string" ? params.status.toUpperCase() : "PENDING";
  const status = (LEAVE_STATUSES as readonly string[]).includes(s) ? (s as LeaveStatusKey) : s === "ALL" ? null : "PENDING";
  const w = typeof params.who === "string" ? params.who : "";
  const who: LeaveApplicantKey | "mine" | null = w === "mine" ? "mine" : ((LEAVE_APPLICANTS as readonly string[]).includes(w.toUpperCase()) ? (w.toUpperCase() as LeaveApplicantKey) : null);
  return { status, who };
}

/** One page of requests matching the filters, and the count of each status (for the tabs). */
export async function listLeave(actor: LeaveActor, filters: ReturnType<typeof leaveFilters>, params: Record<string, string | string[] | undefined>) {
  const base = visibleWhere(actor);
  const { who } = filters;
  const whoWhere: Prisma.LeaveRequestWhereInput =
    who === "mine" ? (actor.kind === "teacher" ? { teacherId: actor.ctx.teacher.id } : {}) : who ? { applicant: who } : {};
  const where = { AND: [base, whoWhere, filters.status ? { status: filters.status } : {}] };
  const [total, counts, urgent] = await Promise.all([
    db.leaveRequest.count({ where }),
    db.leaveRequest.groupBy({ by: ["status"], where: { AND: [base, whoWhere] }, _count: true }),
    db.leaveRequest.count({ where: { AND: [base, whoWhere, { status: "PENDING", createdAt: { lt: new Date(Date.now() - LEAVE_URGENT_HOURS * 3_600_000) } }] } }),
  ]);
  const paging = paginate(params, total);
  const rows = await db.leaveRequest.findMany({
    where,
    include,
    // Pending: oldest first (the queue); decided: latest first.
    orderBy: filters.status === "PENDING" ? [{ fromDate: "asc" }, { createdAt: "asc" }] : [{ fromDate: "desc" }, { createdAt: "desc" }],
    skip: paging.skip,
    take: paging.take,
  });
  const byStatus = Object.fromEntries(LEAVE_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count ?? 0])) as Record<LeaveStatusKey, number>;
  const views = rows.map((r) => view(actor, r));
  // Clash warnings only matter while a request is still to be decided.
  const clashes = await departmentClashes(actor.schoolId, views.filter((v) => v.status === "PENDING"));
  return { rows: views.map((v) => ({ ...v, clash: clashes.get(v.id) ?? null })), paging, byStatus, urgent };
}

/* ───────────────────────── Who a request can be for ───────────────────────── */

/** People the actor may enter a request for (a teacher also always applies for themselves). */
export async function leavePeople(actor: LeaveActor): Promise<LeavePerson[]> {
  const sectionWhere = actor.kind === "teacher" ? (actor.ctx.classSections.length ? { sectionId: { in: actor.ctx.classSections.map((s) => s.id) } } : { id: "" }) : {};
  const [students, teachers, staff] = await Promise.all([
    db.student.findMany({
      where: { schoolId: actor.schoolId, status: "ACTIVE", ...sectionWhere },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, rollNumber: true, section: { include: { class: true } } },
    }),
    actor.kind === "admin"
      ? db.teacher.findMany({ where: { schoolId: actor.schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] })
      : [],
    actor.kind === "admin" ? db.staffMember.findMany({ where: { schoolId: actor.schoolId, status: "ACTIVE" }, orderBy: { name: "asc" } }) : [],
  ]);
  return [
    ...students.map((s) => ({
      id: s.id,
      applicant: "STUDENT" as const,
      name: fullName(s),
      sub: [s.section ? sectionLabel(s.section) : null, s.rollNumber ? `Roll ${s.rollNumber}` : null, s.studentCode].filter(Boolean).join(" · "),
    })),
    ...teachers.map((t) => ({ id: t.id, applicant: "TEACHER" as const, name: fullName(t), sub: `Teacher · ${t.employeeCode}` })),
    ...staff.map((s) => ({ id: s.id, applicant: "STAFF" as const, name: s.name, sub: `${s.designation} · ${s.employeeCode}` })),
  ];
}

/* ───────────────────────── Applying ───────────────────────── */

const requestSchema = z
  .object({
    applicant: z.enum(LEAVE_APPLICANTS, "Choose who the leave is for"),
    personId: z.string().min(1, "Choose the person"),
    fromDate: z.string().refine((v) => parseISODate(v), "Choose the first day"),
    toDate: z.string().refine((v) => parseISODate(v), "Choose the last day"),
    category: z.enum(LEAVE_CATEGORIES, "Choose a reason"),
    description: z
      .string()
      .trim()
      .max(500, "Keep it under 500 characters")
      .optional()
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (!parseISODate(v.fromDate) || !parseISODate(v.toDate)) return;
    if (v.toDate < v.fromDate) ctx.addIssue({ code: "custom", path: ["toDate"], message: "The last day is before the first day" });
    else if (leaveDays(v.fromDate, v.toDate) > MAX_LEAVE_DAYS) ctx.addIssue({ code: "custom", path: ["toDate"], message: `At most ${MAX_LEAVE_DAYS} days at a time` });
  });

const personKey = { STUDENT: "studentId", TEACHER: "teacherId", STAFF: "staffId" } as const;

export async function createLeaveRecord(actor: LeaveActor, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData);
  // A teacher applying for themselves doesn't pick a person.
  if (actor.kind === "teacher" && raw.applicant === "TEACHER") raw.personId = actor.ctx.teacher.id;
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const allowed = actor.kind === "teacher" && v.applicant === "TEACHER" ? v.personId === actor.ctx.teacher.id : (await leavePeople(actor)).some((p) => p.id === v.personId && p.applicant === v.applicant);
  if (!allowed) {
    const message = actor.kind === "teacher" ? "You can enter leave only for yourself and the students of your class." : "Choose someone from the list.";
    return { error: message, fieldErrors: { personId: [message] } };
  }

  // Optional supporting document (medical certificate etc.): PDF or image.
  let upload: Awaited<ReturnType<typeof readDocumentUpload>> | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    upload = await readDocumentUpload(formData, "attachment");
    const bad = "error" in upload ? (upload.error.startsWith("Only ") ? "Attach a PDF, JPG, PNG or WebP file." : upload.error) : !INLINE_TYPES.has(upload.file.mimeType) ? "Attach a PDF, JPG, PNG or WebP file." : null;
    if (bad) return { error: bad, fieldErrors: { attachment: [bad] } };
  }

  const from = parseISODate(v.fromDate)!;
  const to = parseISODate(v.toDate)!;
  const key = personKey[v.applicant];
  const overlap = await db.leaveRequest.findFirst({
    where: { schoolId: actor.schoolId, [key]: v.personId, status: { not: "REJECTED" }, fromDate: { lte: to }, toDate: { gte: from } },
  });
  if (overlap) {
    const message = `There is already a ${overlap.status === "PENDING" ? "pending" : "approved"} request from ${isoDate(overlap.fromDate)} to ${isoDate(overlap.toDate)} for these dates.`;
    return { error: message, fieldErrors: { fromDate: [message] } };
  }

  const approveNow = formData.get("approveNow") === "on" && actor.kind === "admin";
  const requestedBy = actor.kind === "admin" ? `${actor.who} (admin)` : actor.who;
  const created = await db.leaveRequest.create({
    data: {
      schoolId: actor.schoolId,
      applicant: v.applicant,
      [key]: v.personId,
      fromDate: from,
      toDate: to,
      category: v.category,
      description: v.description,
      requestedBy,
      ...(approveNow && { status: "APPROVED" as const, decidedBy: requestedBy, decidedAt: new Date() }),
      ...(upload && "file" in upload && { attachment: { create: upload.file } }),
    },
  });
  if (approveNow) await applyApprovedLeave(created);
  const days = leaveDays(v.fromDate, v.toDate);
  return {
    ok: true,
    message: `${APPLICANT_LABELS[v.applicant]} leave for ${days} day${days === 1 ? "" : "s"} ${approveNow ? "added and approved" : "submitted for approval"}.`,
  };
}

/* ───────────────────────── Deciding ───────────────────────── */

/**
 * An approved leave turns marks already saved in its dates into "Leave": every
 * mark for a student (their leave days are locked), only "Absent" for staff.
 */
async function applyApprovedLeave(r: { schoolId: string; studentId: string | null; teacherId: string | null; staffId: string | null; fromDate: Date; toDate: Date }) {
  const dates = { gte: r.fromDate, lte: r.toDate };
  if (r.studentId) {
    await db.attendanceRecord.updateMany({
      where: { studentId: r.studentId, status: { not: "LEAVE" }, day: { date: dates } },
      data: { status: "LEAVE", remark: "Approved leave" },
    });
  } else {
    await db.staffAttendance.updateMany({
      where: { schoolId: r.schoolId, ...(r.teacherId ? { teacherId: r.teacherId } : { staffId: r.staffId }), status: "ABSENT", date: dates },
      data: { status: "ON_LEAVE" },
    });
  }
}

export async function decideLeaveRecord(actor: LeaveActor, id: string, approve: boolean, formData: FormData): Promise<ActionState> {
  const r = await db.leaveRequest.findFirst({ where: { AND: [visibleWhere(actor), { id }] }, include });
  if (!r) return { error: "Leave request not found." };
  if (r.status !== "PENDING") return { error: `This request was already ${r.status.toLowerCase()}.` };
  if (!canDecide(actor, r)) return { error: "You can't decide this request." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  if (!approve && !note) return { error: "Give a reason for rejecting.", fieldErrors: { note: ["Give a reason for rejecting"] } };

  const decidedBy = actor.kind === "admin" ? `${actor.who} (admin)` : `${actor.who} (class teacher)`;
  await db.leaveRequest.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", decidedBy, decidedAt: new Date(), decisionNote: note },
  });
  if (approve) await applyApprovedLeave(r);
  return { ok: true, message: `${view(actor, r).person.name}'s leave ${approve ? "approved" : "rejected"}.` };
}

export async function withdrawLeaveRecord(actor: LeaveActor, id: string): Promise<ActionState> {
  const r = await db.leaveRequest.findFirst({ where: { AND: [visibleWhere(actor), { id }] }, include });
  if (!r || !view(actor, r).canWithdraw) return { error: "You can't remove this request." };
  await db.leaveRequest.delete({ where: { id } });
  return { ok: true, message: r.status === "PENDING" ? "Leave request withdrawn." : "Leave request deleted." };
}

/* ───────────────────────── Dashboard ───────────────────────── */

/**
 * The leave picture around a date (an ISO date, normally today): requests
 * waiting for a decision, who is on approved leave that day, and approved
 * leave starting later. Each list has at most `take` rows plus its full count.
 */
export async function leaveOverview(actor: LeaveActor, date: string, take = 5) {
  const day = parseISODate(date)!;
  const base = visibleWhere(actor);
  const pendingWhere = { AND: [base, { status: "PENDING" as const }] };
  const todayWhere = { AND: [base, { status: "APPROVED" as const, fromDate: { lte: day }, toDate: { gte: day } }] };
  const upcomingWhere = { AND: [base, { status: "APPROVED" as const, fromDate: { gt: day } }] };
  const [pending, today, upcoming, pendingCount, todayCount, upcomingCount] = await Promise.all([
    db.leaveRequest.findMany({ where: pendingWhere, include, orderBy: [{ fromDate: "asc" }, { createdAt: "asc" }], take }),
    db.leaveRequest.findMany({ where: todayWhere, include, orderBy: [{ toDate: "asc" }, { createdAt: "asc" }], take }),
    db.leaveRequest.findMany({ where: upcomingWhere, include, orderBy: [{ fromDate: "asc" }, { createdAt: "asc" }], take }),
    db.leaveRequest.count({ where: pendingWhere }),
    db.leaveRequest.count({ where: todayWhere }),
    db.leaveRequest.count({ where: upcomingWhere }),
  ]);
  return {
    pending: { rows: pending.map((r) => view(actor, r)), total: pendingCount },
    today: { rows: today.map((r) => view(actor, r)), total: todayCount },
    upcoming: { rows: upcoming.map((r) => view(actor, r)), total: upcomingCount },
  };
}

export type LeaveOverview = Awaited<ReturnType<typeof leaveOverview>>;

/* ───────────────────────── For attendance ───────────────────────── */

/** Ids of people (students, or teachers / staff) on approved leave on a date. */
export async function onLeave(schoolId: string, date: Date) {
  const rows = await db.leaveRequest.findMany({
    where: { schoolId, status: "APPROVED", fromDate: { lte: date }, toDate: { gte: date } },
    select: { studentId: true, teacherId: true, staffId: true },
  });
  return new Set(rows.flatMap((r) => [r.studentId, r.teacherId, r.staffId]).filter((x): x is string => !!x));
}

/** Approved leave covering a date, by person id (student, teacher or staff member). */
export async function approvedLeaveOn(schoolId: string, date: Date) {
  const rows = await db.leaveRequest.findMany({
    where: { schoolId, status: "APPROVED", fromDate: { lte: date }, toDate: { gte: date } },
    select: { id: true, studentId: true, teacherId: true, staffId: true, category: true, fromDate: true, toDate: true },
  });
  return new Map(rows.map((r) => [(r.studentId ?? r.teacherId ?? r.staffId)!, r]));
}

/* ───────────────────────── Working days, balances and clashes ───────────────────────── */

/** Dates from `from` to `to` that are neither Sundays nor school holidays. */
async function workingDates(schoolId: string, from: string, to: string) {
  const holidays = await db.holiday.findMany({ where: { schoolId, date: { gte: parseISODate(from)!, lte: parseISODate(to)! } }, select: { date: true } });
  const off = new Set(holidays.map((h) => isoDate(h.date)));
  return datesBetween(from, to).filter((d) => !isSunday(d) && !off.has(d));
}

/** Leave days per session for teachers and staff, by leave type (null = no limit set). */
export async function loadAllowances(schoolId: string) {
  const rows = await db.leaveAllowance.findMany({ where: { schoolId } });
  const out = { TEACHER: {}, STAFF: {} } as Record<"TEACHER" | "STAFF", Partial<Record<LeaveCategoryKey, number>>>;
  for (const r of rows) if (r.applicant !== "STUDENT") out[r.applicant][r.category] = r.days;
  return out;
}

/** Saves allowances from fields `a:TEACHER:CASUAL` = days (blank removes the limit). */
export async function saveAllowanceRecords(schoolId: string, formData: FormData): Promise<ActionState> {
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  for (const applicant of ["TEACHER", "STAFF"] as const) {
    for (const category of LEAVE_CATEGORIES) {
      const raw = String(formData.get(`a:${applicant}:${category}`) ?? "").trim();
      const where = { schoolId_applicant_category: { schoolId, applicant, category } };
      if (!raw) {
        writes.push(db.leaveAllowance.deleteMany({ where: { schoolId, applicant, category } }));
        continue;
      }
      const days = Number(raw);
      if (!Number.isInteger(days) || days < 0 || days > 365) return { error: "Enter whole days from 0 to 365, or leave it blank for no limit." };
      writes.push(db.leaveAllowance.upsert({ where, create: { schoolId, applicant, category, days }, update: { days } }));
    }
  }
  await db.$transaction(writes);
  return { ok: true, message: "Leave allowances saved." };
}

export type BalanceRow = { category: LeaveCategoryKey; allowed: number | null; used: number; pending: number };

/**
 * A teacher's or staff member's leave this session by type: the allowance,
 * working days taken (approved) and waiting (pending).
 */
export async function leaveBalance(schoolId: string, applicant: "TEACHER" | "STAFF", personId: string) {
  const session = await getCurrentSession(schoolId);
  const from = isoDate(session.startDate);
  const to = isoDate(session.endDate);
  const [allowances, requests, working] = await Promise.all([
    loadAllowances(schoolId),
    db.leaveRequest.findMany({
      where: { schoolId, [personKey[applicant]]: personId, status: { in: ["APPROVED", "PENDING"] }, fromDate: { lte: session.endDate }, toDate: { gte: session.startDate } },
      select: { category: true, status: true, fromDate: true, toDate: true },
    }),
    workingDates(schoolId, from, to),
  ]);
  const workSet = new Set(working);
  const rows: BalanceRow[] = LEAVE_CATEGORIES.map((category) => ({ category, allowed: allowances[applicant][category] ?? null, used: 0, pending: 0 }));
  for (const r of requests) {
    const days = datesBetween(isoDate(r.fromDate), isoDate(r.toDate)).filter((d) => workSet.has(d)).length;
    const row = rows.find((x) => x.category === r.category)!;
    if (r.status === "APPROVED") row.used += days;
    else row.pending += days;
  }
  return { session: session.name, rows };
}

/**
 * Warnings for teacher / staff requests whose department would have more than
 * 20% of its people on leave at once, e.g. "2 teachers from the Mathematics
 * department are already on leave on these dates". Keyed by request id.
 */
export async function departmentClashes(schoolId: string, items: Pick<LeaveView, "id" | "applicant" | "personId" | "from" | "to" | "department">[]) {
  const staffItems = items.filter((i) => i.applicant !== "STUDENT" && i.department);
  const out = new Map<string, string>();
  if (!staffItems.length) return out;
  const min = staffItems.reduce((m, i) => (i.from < m ? i.from : m), staffItems[0].from);
  const max = staffItems.reduce((m, i) => (i.to > m ? i.to : m), staffItems[0].to);
  const [teachers, staff, approved] = await Promise.all([
    db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, specialization: true } }),
    db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, department: true } }),
    db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", applicant: { in: ["TEACHER", "STAFF"] }, fromDate: { lte: parseISODate(max)! }, toDate: { gte: parseISODate(min)! } },
      select: { id: true, teacherId: true, staffId: true, fromDate: true, toDate: true },
    }),
  ]);
  const deptOf = new Map<string, string>([
    ...teachers.map((t) => [t.id, `T:${teacherDepartment(t)}`] as const),
    ...staff.map((s) => [s.id, `S:${staffDepartment(s)}`] as const),
  ]);
  const size = new Map<string, number>();
  for (const d of deptOf.values()) size.set(d, (size.get(d) ?? 0) + 1);

  for (const i of staffItems) {
    const dept = `${i.applicant === "TEACHER" ? "T" : "S"}:${i.department}`;
    const others = new Set(
      approved
        .filter((a) => a.id !== i.id && isoDate(a.fromDate) <= i.to && isoDate(a.toDate) >= i.from)
        .map((a) => (a.teacherId ?? a.staffId)!)
        .filter((p) => p !== i.personId && deptOf.get(p) === dept),
    ).size;
    const total = size.get(dept) ?? 1;
    if (others > 0 && (others + 1) / total > CLASH_SHARE) {
      const noun = i.applicant === "TEACHER" ? (others === 1 ? "teacher" : "teachers") : others === 1 ? "staff member" : "staff members";
      out.set(i.id, `${others} ${noun} from the ${i.department} department ${others === 1 ? "is" : "are"} already on leave on these dates (${others + 1} of ${total} with this one).`);
    }
  }
  return out;
}

/** Everything the review drawer shows for one request, or null if the actor can't see it. */
export async function leaveDetail(actor: LeaveActor, id: string) {
  const r = await db.leaveRequest.findFirst({ where: { AND: [visibleWhere(actor), { id }] }, include });
  if (!r) return null;
  const v = view(actor, r);
  const [working, clashes, balance, history] = await Promise.all([
    workingDates(actor.schoolId, v.from, v.to),
    departmentClashes(actor.schoolId, [v]),
    v.applicant === "STUDENT" ? null : leaveBalance(actor.schoolId, v.applicant, v.personId),
    db.leaveRequest.findMany({
      where: { schoolId: actor.schoolId, [personKey[v.applicant]]: v.personId, id: { not: id } },
      orderBy: { fromDate: "desc" },
      take: 5,
      select: { id: true, fromDate: true, toDate: true, category: true, status: true },
    }),
  ]);
  return {
    ...v,
    workingDays: working.length,
    clash: clashes.get(id) ?? null,
    balance,
    history: history.map((h) => ({ id: h.id, from: isoDate(h.fromDate), to: isoDate(h.toDate), category: h.category, status: h.status })),
  };
}

export type LeaveDetail = NonNullable<Awaited<ReturnType<typeof leaveDetail>>>;

/** Approves several pending requests at once; reports how many went through. */
export async function bulkApproveRecords(actor: LeaveActor, ids: string[]): Promise<ActionState> {
  const unique = [...new Set(ids)].slice(0, 100);
  if (!unique.length) return { error: "Select at least one request." };
  let ok = 0;
  const failed: string[] = [];
  for (const id of unique) {
    const r = await decideLeaveRecord(actor, id, true, new FormData());
    if (r.ok) ok++;
    else if (r.error) failed.push(r.error);
  }
  if (!ok) return { error: failed[0] ?? "Nothing was approved." };
  return { ok: true, message: `Approved ${ok} request${ok === 1 ? "" : "s"}${failed.length ? `; ${failed.length} couldn't be approved` : ""}.` };
}

/** Whether the actor may see this request (and its attachment). */
export async function canSeeLeave(actor: LeaveActor, id: string) {
  return (await db.leaveRequest.count({ where: { AND: [visibleWhere(actor), { id }] } })) > 0;
}
