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
import { datesBetween, isoDate, monthDates, parseISODate } from "@/lib/attendance-shared";
import { daysOff } from "@/lib/attendance";
import { db } from "@/lib/db";
import { INLINE_TYPES, readDocumentUpload } from "@/lib/documents";
import {
  APPLICANT_LABELS,
  LEAVE_APPLICANTS,
  LEAVE_CATEGORIES,
  LEAVE_STATUSES,
  MAX_LEAVE_DAYS,
  PROOF_REASON_MIN,
  CATEGORY_LABELS,
  CATEGORY_SHORT,
  leaveDays,
  readLeaveRules,
  splitByMonthlyCap,
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
import { logged } from "@/lib/activity";

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
  student: { select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, sectionId: true, section: { include: { class: true } } } },
  teacher: { select: { id: true, firstName: true, middleName: true, lastName: true, employeeCode: true, specialization: true } },
  staff: { select: { id: true, name: true, designation: true, employeeCode: true, department: true } },
  attachment: { select: { fileName: true, mimeType: true, size: true } },
} satisfies Prisma.LeaveRequestInclude;

type Row = Prisma.LeaveRequestGetPayload<{ include: typeof include }>;

function view(actor: LeaveActor, r: Row) {
  const person =
    r.applicant === "STUDENT" && r.student
      ? { name: fullName(r.student), sub: r.student.section ? sectionLabel(r.student.section) : "No class", href: `/students/${r.student.id}`, code: r.student.studentCode }
      : r.applicant === "TEACHER" && r.teacher
        ? { name: fullName(r.teacher), sub: `Teacher · ${r.teacher.employeeCode}`, href: `/teachers/${r.teacher.id}`, code: r.teacher.employeeCode }
        : r.staff
          ? { name: r.staff.name, sub: `${r.staff.designation} · ${r.staff.employeeCode}`, href: `/staff/${r.staff.id}`, code: r.staff.employeeCode }
          : { name: "Removed", sub: "", href: null, code: null };
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
    /** Approved days over the monthly cap for this type: absent (unpaid), not leave. */
    overLimit: r.overLimitDates,
    /** Department for teachers (specialisation) and staff, for clash checks. */
    department: r.teacher ? teacherDepartment(r.teacher) : r.staff ? staffDepartment(r.staff) : null,
    /** Admins can delete any request; a teacher can withdraw their own while it is pending. */
    canWithdraw: actor.kind === "admin" || (r.status === "PENDING" && actor.kind === "teacher" && r.teacherId === actor.ctx.teacher.id),
    mine: actor.kind === "teacher" && r.teacherId === actor.ctx.teacher.id,
  };
}

export type LeaveView = ReturnType<typeof view>;

/**
 * ?status=pending|approved|rejected|all, ?who=student|teacher|staff|mine,
 * ?q= (a name or ID) and ?on= (leave covering that day) from the URL. A search
 * looks at every status, and a day at approved leave, unless one is picked.
 */
export function leaveFilters(params: Record<string, string | string[] | undefined>) {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const on = typeof params.on === "string" && parseISODate(params.on) ? params.on : null;
  const s = typeof params.status === "string" ? params.status.toUpperCase() : on ? "APPROVED" : q ? "ALL" : "PENDING";
  const status = (LEAVE_STATUSES as readonly string[]).includes(s) ? (s as LeaveStatusKey) : s === "ALL" ? null : "PENDING";
  const w = typeof params.who === "string" ? params.who : "";
  const who: LeaveApplicantKey | "mine" | null = w === "mine" ? "mine" : ((LEAVE_APPLICANTS as readonly string[]).includes(w.toUpperCase()) ? (w.toUpperCase() as LeaveApplicantKey) : null);
  return { status, who, q, on };
}

/** Requests whose person matches every word of the search (names, student ID or employee code). */
function searchWhere(q: string): Prisma.LeaveRequestWhereInput {
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return {};
  const has = (w: string) => ({ contains: w, mode: "insensitive" as const });
  return {
    AND: words.map((w) => ({
      OR: [
        { student: { OR: [{ firstName: has(w) }, { middleName: has(w) }, { lastName: has(w) }, { studentCode: has(w) }] } },
        { teacher: { OR: [{ firstName: has(w) }, { middleName: has(w) }, { lastName: has(w) }, { employeeCode: has(w) }] } },
        { staff: { OR: [{ name: has(w) }, { employeeCode: has(w) }] } },
      ],
    })),
  };
}

/** One page of requests matching the filters, and the count of each status (for the tabs). */
export async function listLeave(actor: LeaveActor, filters: ReturnType<typeof leaveFilters>, params: Record<string, string | string[] | undefined>) {
  const base = visibleWhere(actor);
  const { who } = filters;
  const whoWhere: Prisma.LeaveRequestWhereInput = {
    AND: [who === "mine" ? (actor.kind === "teacher" ? { teacherId: actor.ctx.teacher.id } : {}) : who ? { applicant: who } : {}, searchWhere(filters.q),
      filters.on ? { fromDate: { lte: parseISODate(filters.on)! }, toDate: { gte: parseISODate(filters.on)! } } : {},
    ],
  };
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
  return {
    rows: views.map((v) => ({ ...v, clash: clashes.get(v.id) ?? null })),
    paging,
    byStatus,
    urgent,
    people: filters.q ? await leaveTally(actor, { AND: [base, whoWhere] }) : [],
  };
}

export type LeaveTally = {
  key: string;
  applicant: LeaveApplicantKey;
  name: string;
  sub: string;
  href: string | null;
  requests: number;
  approved: number;
  pending: number;
  rejected: number;
  approvedDays: number;
};

/** For a search: each matching person with how many times they asked for leave, and the days approved (most first). */
async function leaveTally(actor: LeaveActor, where: Prisma.LeaveRequestWhereInput): Promise<LeaveTally[]> {
  const rows = await db.leaveRequest.findMany({ where, include, orderBy: { fromDate: "desc" }, take: 1000 });
  const people = new Map<string, LeaveTally>();
  for (const r of rows) {
    const v = view(actor, r);
    const key = `${v.applicant}:${v.personId}`;
    const p = people.get(key) ?? { key, applicant: v.applicant, ...v.person, requests: 0, approved: 0, pending: 0, rejected: 0, approvedDays: 0 };
    p.requests++;
    if (v.status === "APPROVED") {
      p.approved++;
      p.approvedDays += v.days;
    } else if (v.status === "PENDING") p.pending++;
    else p.rejected++;
    people.set(key, p);
  }
  return [...people.values()].sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name));
}

/** One person's leave requests (newest first), each with its length in days. */
export async function personLeave(schoolId: string, applicant: LeaveApplicantKey, personId: string) {
  const rows = await db.leaveRequest.findMany({
    where: { schoolId, [personKey[applicant]]: personId },
    orderBy: [{ fromDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, fromDate: true, toDate: true, category: true, description: true, status: true, requestedBy: true, decidedBy: true, decisionNote: true, overLimitDates: true },
  });
  return rows.map((r) => {
    const from = isoDate(r.fromDate);
    const to = isoDate(r.toDate);
    return { ...r, from, to, days: leaveDays(from, to) };
  });
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
    if (v.applicant === "STUDENT" && v.category === "PRIVILEGED") ctx.addIssue({ code: "custom", path: ["category"], message: "Privileged leave is for teachers and staff" });
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

  // Teachers' and staff leave follows the school's rules: proof for some types, a monthly cap.
  const staffApplicant = v.applicant === "TEACHER" || v.applicant === "STAFF" ? v.applicant : null;
  const rules = staffApplicant ? await loadLeaveRules(actor.schoolId) : null;
  if (staffApplicant && rules?.proof.includes(v.category)) {
    const label = CATEGORY_LABELS[v.category].toLowerCase();
    if (!upload) return { error: `${CATEGORY_LABELS[v.category]} needs a supporting document, e.g. a medical certificate.`, fieldErrors: { attachment: ["Attach the document"] } };
    if ((v.description?.length ?? 0) < PROOF_REASON_MIN)
      return { error: `Write the reason for ${label} (at least ${PROOF_REASON_MIN} characters).`, fieldErrors: { description: ["Describe the reason"] } };
  }

  const from = parseISODate(v.fromDate)!;
  const to = parseISODate(v.toDate)!;
  const key = personKey[v.applicant];
  const cap = staffApplicant ? rules?.monthly[staffApplicant][v.category] : undefined;
  if (staffApplicant && cap != null) {
    const usage = await monthUsage(actor.schoolId, staffApplicant, v.personId, v.fromDate.slice(0, 7), v.toDate.slice(0, 7));
    const used: Record<string, number> = {};
    for (const [m, u] of Object.entries(usage[v.category] ?? {})) used[m] = u.counted + u.pending;
    const { over } = splitByMonthlyCap(await workingDates(actor.schoolId, v.fromDate, v.toDate), cap, used);
    if (over.length && formData.get("acceptOverLimit") !== "on") {
      const message = `Only ${cap} day${cap === 1 ? "" : "s"} of ${CATEGORY_SHORT[v.category]} a month count as leave. ${over.length} day${over.length === 1 ? "" : "s"} of this request would be absent (unpaid): tick the box to apply anyway.`;
      return { error: message, fieldErrors: { acceptOverLimit: [message] } };
    }
  }
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
  if (approveNow) await settleApproved(created);
  const days = leaveDays(v.fromDate, v.toDate);
  return logged("Leave", {
    ok: true,
    message: `${APPLICANT_LABELS[v.applicant]} leave for ${days} day${days === 1 ? "" : "s"} ${approveNow ? "added and approved" : "submitted for approval"}.`,
  });
}

/**
 * A student applies for their own leave from the student portal. It waits for
 * their class teacher (or a school admin) to decide, like any other request.
 */
export async function createStudentLeaveRecord(student: { id: string; schoolId: string; firstName: string; lastName: string }, formData: FormData): Promise<ActionState> {
  const raw = { ...Object.fromEntries(formData), applicant: "STUDENT", personId: student.id };
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  let upload: Awaited<ReturnType<typeof readDocumentUpload>> | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    upload = await readDocumentUpload(formData, "attachment");
    const bad = "error" in upload ? (upload.error.startsWith("Only ") ? "Attach a PDF, JPG, PNG or WebP file." : upload.error) : !INLINE_TYPES.has(upload.file.mimeType) ? "Attach a PDF, JPG, PNG or WebP file." : null;
    if (bad) return { error: bad, fieldErrors: { attachment: [bad] } };
  }
  const from = parseISODate(v.fromDate)!;
  const to = parseISODate(v.toDate)!;
  const overlap = await db.leaveRequest.findFirst({ where: { schoolId: student.schoolId, studentId: student.id, status: { not: "REJECTED" }, fromDate: { lte: to }, toDate: { gte: from } } });
  if (overlap) {
    const message = `You already have a ${overlap.status === "PENDING" ? "pending" : "approved"} request from ${isoDate(overlap.fromDate)} to ${isoDate(overlap.toDate)}.`;
    return { error: message, fieldErrors: { fromDate: [message] } };
  }
  await db.leaveRequest.create({
    data: {
      schoolId: student.schoolId,
      applicant: "STUDENT",
      studentId: student.id,
      fromDate: from,
      toDate: to,
      category: v.category,
      description: v.description,
      requestedBy: `${student.firstName} ${student.lastName} (student)`,
      ...(upload && "file" in upload && { attachment: { create: upload.file } }),
    },
  });
  const days = leaveDays(v.fromDate, v.toDate);
  return logged("Leave", { ok: true, message: `Leave for ${days} day${days === 1 ? "" : "s"} sent to your class teacher.` }, `Applied for ${days} day${days === 1 ? "" : "s"} of leave (${v.fromDate} to ${v.toDate})`);
}

/** A student withdraws their own request while it's still waiting. */
export async function withdrawStudentLeaveRecord(studentId: string, id: string): Promise<ActionState> {
  const r = await db.leaveRequest.findFirst({ where: { id, studentId, status: "PENDING" } });
  if (!r) return { error: "Only a request that is still waiting can be withdrawn." };
  await db.leaveRequest.delete({ where: { id } });
  return logged("Leave", { ok: true, message: "Leave request withdrawn." }, `Withdrew leave request (${isoDate(r.fromDate)} to ${isoDate(r.toDate)})`);
}

/* ───────────────────────── Deciding ───────────────────────── */

/**
 * An approved leave turns marks already saved in its dates into "Leave": every
 * mark for a student (their leave days are locked), only "Absent" for staff.
 */
async function applyApprovedLeave(r: { schoolId: string; studentId: string | null; teacherId: string | null; staffId: string | null; fromDate: Date; toDate: Date; overLimitDates?: string[] }) {
  const dates = { gte: r.fromDate, lte: r.toDate };
  if (r.studentId) {
    await db.attendanceRecord.updateMany({
      where: { studentId: r.studentId, status: { not: "LEAVE" }, day: { date: dates } },
      data: { status: "LEAVE", remark: "Approved leave" },
    });
  } else {
    // Days over the monthly cap stay (or become) absent; the rest are leave.
    const who = r.teacherId ? { teacherId: r.teacherId } : { staffId: r.staffId };
    const over = (r.overLimitDates ?? []).map((d) => parseISODate(d)!);
    await db.$transaction([
      db.staffAttendance.updateMany({
        where: { schoolId: r.schoolId, ...who, status: "ABSENT", date: dates, ...(over.length && { NOT: { date: { in: over } } }) },
        data: { status: "ON_LEAVE" },
      }),
      ...(over.length
        ? [db.staffAttendance.updateMany({ where: { schoolId: r.schoolId, ...who, status: "ON_LEAVE", date: { in: over } }, data: { status: "ABSENT", remark: "Over the monthly leave limit" } })]
        : []),
    ]);
  }
}

/**
 * Works out which days of a teacher's or staff member's approved leave of one
 * type are over the school's monthly cap, for the months `months` touches:
 * leave approved earlier counts first. Saves the days on each request and
 * moves their attendance marks between Leave and Absent to match.
 */
async function recountOverLimit(schoolId: string, applicant: "TEACHER" | "STAFF", personId: string, category: LeaveCategoryKey, months: string[]) {
  const cap = (await loadLeaveRules(schoolId)).monthly[applicant][category];
  const touched = new Set(months);
  const requests = await db.leaveRequest.findMany({
    where: { schoolId, [personKey[applicant]]: personId, category, status: "APPROVED" },
    orderBy: [{ decidedAt: "asc" }, { createdAt: "asc" }],
  });
  const inTouched = requests.filter((r) => datesBetween(isoDate(r.fromDate), isoDate(r.toDate)).some((d) => touched.has(d.slice(0, 7))));
  if (!inTouched.length) return;
  const min = inTouched.reduce((m, r) => (isoDate(r.fromDate) < m ? isoDate(r.fromDate) : m), isoDate(inTouched[0].fromDate));
  const max = inTouched.reduce((m, r) => (isoDate(r.toDate) > m ? isoDate(r.toDate) : m), isoDate(inTouched[0].toDate));
  const working = new Set(await workingDates(schoolId, min, max));
  const used: Record<string, number> = {};
  for (const r of inTouched) {
    const dates = datesBetween(isoDate(r.fromDate), isoDate(r.toDate)).filter((d) => working.has(d) && touched.has(d.slice(0, 7)));
    const { counted, over } = splitByMonthlyCap(dates, cap, used);
    for (const d of counted) used[d.slice(0, 7)] = (used[d.slice(0, 7)] ?? 0) + 1;
    // Days in other months keep what was worked out for them.
    const next = [...r.overLimitDates.filter((d) => !touched.has(d.slice(0, 7))), ...over].sort();
    if (next.join() !== r.overLimitDates.join()) {
      await db.leaveRequest.update({ where: { id: r.id }, data: { overLimitDates: next } });
      await applyApprovedLeave({ ...r, overLimitDates: next });
    }
  }
}

/** Months (YYYY-MM) from one date to another. */
const monthsBetween = (from: string, to: string) => [...new Set(datesBetween(from, to).map((d) => d.slice(0, 7)))];

/** After a request is approved: marks attendance, and for teachers and staff applies the monthly cap. */
async function settleApproved(r: { id: string; schoolId: string; applicant: LeaveApplicantKey; studentId: string | null; teacherId: string | null; staffId: string | null; category: LeaveCategoryKey; fromDate: Date; toDate: Date }) {
  await applyApprovedLeave(r);
  if (r.applicant === "TEACHER" || r.applicant === "STAFF")
    await recountOverLimit(r.schoolId, r.applicant, (r.teacherId ?? r.staffId)!, r.category, monthsBetween(isoDate(r.fromDate), isoDate(r.toDate)));
}

/**
 * Keeps the leave module in step with student attendance on one day. A student
 * marked Leave without any leave for that day gets an approved one-day leave
 * (so they show in Leave and on the dashboard); one no longer marked Leave
 * loses the leave that attendance made. Leave people applied for is left alone.
 */
export async function syncAttendanceLeave(
  schoolId: string,
  date: Date,
  marks: { studentId: string; status: string; remark: string | null }[],
  by: string,
) {
  const onLeave = marks.filter((m) => m.status === "LEAVE");
  const notOnLeave = marks.filter((m) => m.status !== "LEAVE").map((m) => m.studentId);
  const covered = new Set(
    onLeave.length
      ? (
          await db.leaveRequest.findMany({
            where: { schoolId, studentId: { in: onLeave.map((m) => m.studentId) }, status: { not: "REJECTED" }, fromDate: { lte: date }, toDate: { gte: date } },
            select: { studentId: true },
          })
        ).map((r) => r.studentId)
      : [],
  );
  const now = new Date();
  await db.$transaction([
    db.leaveRequest.deleteMany({ where: { schoolId, fromAttendance: true, studentId: { in: notOnLeave }, fromDate: date, toDate: date } }),
    db.leaveRequest.createMany({
      data: onLeave
        .filter((m) => !covered.has(m.studentId))
        .map((m) => ({
          schoolId,
          applicant: "STUDENT" as const,
          studentId: m.studentId,
          fromDate: date,
          toDate: date,
          category: "OTHER" as const,
          description: m.remark || "Marked on leave in attendance",
          status: "APPROVED" as const,
          requestedBy: by,
          decidedBy: by,
          decidedAt: now,
          fromAttendance: true,
        })),
    }),
  ]);
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
  if (approve) await settleApproved(r);
  const over = approve ? ((await db.leaveRequest.findUnique({ where: { id }, select: { overLimitDates: true } }))?.overLimitDates.length ?? 0) : 0;
  return logged("Leave", {
    ok: true,
    message: `${view(actor, r).person.name}'s leave ${approve ? "approved" : "rejected"}.${over ? ` ${over} day${over === 1 ? " is" : "s are"} over the monthly limit and count as absent (unpaid).` : ""}`,
  });
}

export async function withdrawLeaveRecord(actor: LeaveActor, id: string): Promise<ActionState> {
  const r = await db.leaveRequest.findFirst({ where: { AND: [visibleWhere(actor), { id }] }, include });
  if (!r || !view(actor, r).canWithdraw) return { error: "You can't remove this request." };
  await db.leaveRequest.delete({ where: { id } });
  // Removing approved leave frees its days: later leave of the type may now count.
  if (r.status === "APPROVED" && (r.applicant === "TEACHER" || r.applicant === "STAFF"))
    await recountOverLimit(r.schoolId, r.applicant, (r.teacherId ?? r.staffId)!, r.category, monthsBetween(isoDate(r.fromDate), isoDate(r.toDate)));
  return logged("Leave", { ok: true, message: r.status === "PENDING" ? "Leave request withdrawn." : "Leave request deleted." }, `${r.status === "PENDING" ? "Withdrew" : "Deleted"} ${view(actor, r).person.name}'s leave (${isoDate(r.fromDate)} to ${isoDate(r.toDate)})`);
}

/* ───────────────────────── Dashboard ───────────────────────── */

/**
 * The leave picture around a date (an ISO date, normally today): requests
 * waiting for a decision, who is on approved leave that day, and approved
 * leave starting later. Each list has at most `take` rows plus its full count.
 */
export async function leaveOverview(actor: LeaveActor, date: string, take = 8) {
  const day = parseISODate(date)!;
  const base = visibleWhere(actor);
  const pendingWhere = { AND: [base, { status: "PENDING" as const }] };
  const todayWhere = { AND: [base, { status: "APPROVED" as const, fromDate: { lte: day }, toDate: { gte: day } }] };
  const upcomingWhere = { AND: [base, { status: "APPROVED" as const, fromDate: { gt: day } }] };
  const [pending, today, upcoming, pendingCount, todayCount, upcomingCount, todayBy, upcomingBy] = await Promise.all([
    // Waiting requests carry approve / reject buttons, so fewer of them fit.
    db.leaveRequest.findMany({ where: pendingWhere, include, orderBy: [{ fromDate: "asc" }, { createdAt: "asc" }], take: Math.min(take, 4) }),
    db.leaveRequest.findMany({ where: todayWhere, include, orderBy: [{ toDate: "asc" }, { createdAt: "asc" }], take }),
    db.leaveRequest.findMany({ where: upcomingWhere, include, orderBy: [{ fromDate: "asc" }, { createdAt: "asc" }], take }),
    db.leaveRequest.count({ where: pendingWhere }),
    db.leaveRequest.count({ where: todayWhere }),
    db.leaveRequest.count({ where: upcomingWhere }),
    db.leaveRequest.groupBy({ by: ["applicant"], where: todayWhere, _count: true }),
    db.leaveRequest.groupBy({ by: ["applicant"], where: upcomingWhere, _count: true }),
  ]);
  const by = (groups: { applicant: LeaveApplicantKey; _count: number }[]) =>
    Object.fromEntries(LEAVE_APPLICANTS.map((a) => [a, groups.find((g) => g.applicant === a)?._count ?? 0])) as Record<LeaveApplicantKey, number>;
  return {
    pending: { rows: pending.map((r) => view(actor, r)), total: pendingCount },
    today: { rows: today.map((r) => view(actor, r)), total: todayCount, byApplicant: by(todayBy) },
    upcoming: { rows: upcoming.map((r) => view(actor, r)), total: upcomingCount, byApplicant: by(upcomingBy) },
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

/** Dates from `from` to `to` that are neither weekly offs nor school holidays. */
async function workingDates(schoolId: string, from: string, to: string) {
  const off = await daysOff(schoolId, from, to);
  return datesBetween(from, to).filter((d) => !off.has(d));
}

/** The school's leave rules: monthly caps and the types that need proof. */
export async function loadLeaveRules(schoolId: string) {
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { leaveRules: true } });
  return readLeaveRules(school?.leaveRules);
}

/** Saves the rules from fields `m:TEACHER:PRIVILEGED` = days a month (blank = no cap) and `proof` = types. */
export async function saveLeaveRulesRecord(schoolId: string, formData: FormData): Promise<ActionState> {
  const monthly = { TEACHER: {}, STAFF: {} } as Record<"TEACHER" | "STAFF", Partial<Record<LeaveCategoryKey, number>>>;
  for (const a of ["TEACHER", "STAFF"] as const)
    for (const c of LEAVE_CATEGORIES) {
      const raw = String(formData.get(`m:${a}:${c}`) ?? "").trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 31) return { error: "Days a month must be whole days from 0 to 31, or blank for no limit." };
      monthly[a][c] = n;
    }
  const proof = LEAVE_CATEGORIES.filter((c) => formData.getAll("proof").includes(c));
  await db.school.update({ where: { id: schoolId }, data: { leaveRules: { monthly, proof } } });
  return logged("Leave", { ok: true, message: "Leave rules saved. They apply to leave approved from now on." });
}

/**
 * A teacher's or staff member's leave by type and month (YYYY-MM, from `fromMonth`
 * to `toMonth`): working days counted as leave (approved, less days over the
 * cap) and days waiting for approval.
 */
export async function monthUsage(schoolId: string, applicant: "TEACHER" | "STAFF", personId: string, fromMonth: string, toMonth: string) {
  const from = `${fromMonth}-01`;
  const to = monthDates(toMonth).at(-1)!;
  const [requests, working] = await Promise.all([
    db.leaveRequest.findMany({
      where: { schoolId, [personKey[applicant]]: personId, status: { in: ["APPROVED", "PENDING"] }, fromDate: { lte: parseISODate(to)! }, toDate: { gte: parseISODate(from)! } },
      select: { category: true, status: true, fromDate: true, toDate: true, overLimitDates: true },
    }),
    workingDates(schoolId, from, to).then((d) => new Set(d)),
  ]);
  const out: Partial<Record<LeaveCategoryKey, Record<string, { counted: number; pending: number }>>> = {};
  for (const r of requests) {
    const over = new Set(r.overLimitDates);
    for (const d of datesBetween(isoDate(r.fromDate), isoDate(r.toDate))) {
      if (!working.has(d) || over.has(d)) continue;
      const m = (out[r.category] ??= {});
      const cell = (m[d.slice(0, 7)] ??= { counted: 0, pending: 0 });
      if (r.status === "APPROVED") cell.counted++;
      else cell.pending++;
    }
  }
  return out;
}

export type MonthUsage = Awaited<ReturnType<typeof monthUsage>>;

/** Days over the monthly cap on a date (approved leave), by teacher / staff id, with the type. */
export async function overLimitOn(schoolId: string, date: string) {
  const d = parseISODate(date)!;
  const rows = await db.leaveRequest.findMany({
    where: { schoolId, status: "APPROVED", applicant: { in: ["TEACHER", "STAFF"] }, overLimitDates: { has: date }, fromDate: { lte: d }, toDate: { gte: d } },
    select: { teacherId: true, staffId: true, category: true },
  });
  return new Map(rows.map((r) => [(r.teacherId ?? r.staffId)!, r.category]));
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
  return logged("Leave", { ok: true, message: "Leave allowances saved." });
}

/* ───────────────────────── Leave groups and extra days ───────────────────────── */

export type LeaveDays = Partial<Record<LeaveCategoryKey, number>>;
type Person = { teacherId: string } | { staffId: string };

/** A group's stored days, keeping only known types with whole days. */
export function policyDays(json: unknown): LeaveDays {
  const out: LeaveDays = {};
  if (json && typeof json === "object") {
    for (const c of LEAVE_CATEGORIES) {
      const v = (json as Record<string, unknown>)[c];
      if (typeof v === "number" && Number.isInteger(v) && v >= 0) out[c] = v;
    }
  }
  return out;
}

/** The school's leave groups with their days and members, by name. */
export async function loadLeavePolicies(schoolId: string) {
  const rows = await db.leavePolicy.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: { where: { status: "ACTIVE" } }, staff: { where: { status: "ACTIVE" } } } } },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, days: policyDays(p.days), teachers: p._count.teachers, staff: p._count.staff }));
}

export type LeavePolicyRow = Awaited<ReturnType<typeof loadLeavePolicies>>[number];

/** Days per type from fields `d:PRIVILEGED` = days (blank = no limit), or an error. */
function readDays(formData: FormData): LeaveDays | { error: string } {
  const days: LeaveDays = {};
  for (const c of LEAVE_CATEGORIES) {
    const raw = String(formData.get(`d:${c}`) ?? "").trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 365) return { error: "Enter whole days from 0 to 365, or leave it blank for no limit." };
    days[c] = n;
  }
  return days;
}

/**
 * Creates or updates a leave group: its name, days per type and members
 * (fields `teacher` / `staff`, ids). Members ticked here move into the group;
 * members unticked leave it and fall back to the school-wide allowance.
 */
export async function saveLeavePolicyRecord(schoolId: string, id: string | null, formData: FormData): Promise<ActionState & { id?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Enter a group name (up to 60 letters).", fieldErrors: { name: ["Enter a group name (up to 60 letters)"] } };
  const days = readDays(formData);
  if ("error" in days) return days;
  const teacherIds = formData.getAll("teacher").map(String);
  const staffIds = formData.getAll("staff").map(String);

  if (id && !(await db.leavePolicy.findFirst({ where: { id, schoolId }, select: { id: true } }))) return { error: "This leave group no longer exists." };
  const clash = await db.leavePolicy.findFirst({ where: { schoolId, name: { equals: name, mode: "insensitive" }, ...(id && { id: { not: id } }) } });
  if (clash) return { error: `There is already a group called ${clash.name}.`, fieldErrors: { name: ["Choose another name"] } };

  const saved = await db.$transaction(async (tx) => {
    const policy = id ? await tx.leavePolicy.update({ where: { id }, data: { name, days } }) : await tx.leavePolicy.create({ data: { schoolId, name, days } });
    await tx.teacher.updateMany({ where: { schoolId, leavePolicyId: policy.id, id: { notIn: teacherIds } }, data: { leavePolicyId: null } });
    await tx.staffMember.updateMany({ where: { schoolId, leavePolicyId: policy.id, id: { notIn: staffIds } }, data: { leavePolicyId: null } });
    if (teacherIds.length) await tx.teacher.updateMany({ where: { schoolId, id: { in: teacherIds } }, data: { leavePolicyId: policy.id } });
    if (staffIds.length) await tx.staffMember.updateMany({ where: { schoolId, id: { in: staffIds } }, data: { leavePolicyId: policy.id } });
    return policy;
  });
  const n = teacherIds.length + staffIds.length;
  return { ...(await logged("Leave", { ok: true, message: `${name} saved with ${n} ${n === 1 ? "person" : "people"}.` })), id: saved.id };
}

/** Deletes a group; its members go back to the school-wide allowance. */
export async function deleteLeavePolicyRecord(schoolId: string, id: string): Promise<ActionState> {
  const policy = await db.leavePolicy.findFirst({ where: { id, schoolId } });
  if (!policy) return { ok: true, message: "Leave group deleted." };
  await db.leavePolicy.delete({ where: { id } });
  return logged("Leave", { ok: true, message: `${policy.name} deleted. Its members now get the school-wide allowance.` });
}

/**
 * One person's leave group and this session's extra days (fields `policy` and
 * `x:PRIVILEGED` = days, negative to take days off, blank or 0 for none).
 */
export async function savePersonLeaveRecord(schoolId: string, person: Person, formData: FormData): Promise<ActionState> {
  const policyId = String(formData.get("policy") ?? "") || null;
  if (policyId && !(await db.leavePolicy.findFirst({ where: { id: policyId, schoolId }, select: { id: true } }))) return { error: "Choose a leave group from the list." };
  const extras: { category: LeaveCategoryKey; days: number }[] = [];
  for (const category of LEAVE_CATEGORIES) {
    const raw = String(formData.get(`x:${category}`) ?? "").trim();
    const days = raw ? Number(raw) : 0;
    if (!Number.isInteger(days) || days < -365 || days > 365) return { error: "Extra days must be whole days from −365 to 365." };
    extras.push({ category, days });
  }
  const isTeacher = "teacherId" in person;
  const exists = isTeacher
    ? await db.teacher.findFirst({ where: { id: person.teacherId, schoolId }, select: { id: true } })
    : await db.staffMember.findFirst({ where: { id: person.staffId, schoolId }, select: { id: true } });
  if (!exists) return { error: "This person was not found." };
  const session = await getCurrentSession(schoolId);
  await db.$transaction([
    isTeacher
      ? db.teacher.update({ where: { id: person.teacherId }, data: { leavePolicyId: policyId } })
      : db.staffMember.update({ where: { id: person.staffId }, data: { leavePolicyId: policyId } }),
    db.leaveExtra.deleteMany({ where: { schoolId, sessionId: session.id, ...person } }),
    db.leaveExtra.createMany({ data: extras.filter((x) => x.days !== 0).map((x) => ({ ...x, ...person, schoolId, sessionId: session.id })) }),
  ]);
  return logged("Leave", { ok: true, message: "Leave group and extra days saved." });
}

/** A person's group and this session's extra days, for their profile. */
export async function personLeaveSetup(schoolId: string, person: Person) {
  const session = await getCurrentSession(schoolId);
  const [who, extras] = await Promise.all([
    "teacherId" in person
      ? db.teacher.findUnique({ where: { id: person.teacherId }, select: { leavePolicyId: true } })
      : db.staffMember.findUnique({ where: { id: person.staffId }, select: { leavePolicyId: true } }),
    db.leaveExtra.findMany({ where: { schoolId, sessionId: session.id, ...person }, select: { category: true, days: true } }),
  ]);
  return { policyId: who?.leavePolicyId ?? null, extras: Object.fromEntries(extras.map((x) => [x.category, x.days])) as LeaveDays, session: session.name };
}

/* ───────────────────────── Balance ───────────────────────── */

export type BalanceRow = {
  category: LeaveCategoryKey;
  /** Days for the session: the group's (or school-wide) days plus extra days; null = no limit. */
  allowed: number | null;
  /** Days added or taken off for this person this session. */
  extra: number;
  used: number;
  pending: number;
};

/**
 * A teacher's or staff member's leave this session by type: the allowance
 * (their leave group's days, else the school-wide allowance, plus extra days
 * given to them this session), working days taken (approved) and waiting (pending).
 * A type with no limit stays unlimited; extra days on it are ignored.
 */
export async function leaveBalance(schoolId: string, applicant: "TEACHER" | "STAFF", personId: string) {
  const session = await getCurrentSession(schoolId);
  const from = isoDate(session.startDate);
  const to = isoDate(session.endDate);
  const person = applicant === "TEACHER" ? { teacherId: personId } : { staffId: personId };
  const [allowances, who, extras, requests, working] = await Promise.all([
    loadAllowances(schoolId),
    applicant === "TEACHER"
      ? db.teacher.findUnique({ where: { id: personId }, select: { leavePolicy: true } })
      : db.staffMember.findUnique({ where: { id: personId }, select: { leavePolicy: true } }),
    db.leaveExtra.findMany({ where: { schoolId, sessionId: session.id, ...person }, select: { category: true, days: true } }),
    db.leaveRequest.findMany({
      where: { schoolId, [personKey[applicant]]: personId, status: { in: ["APPROVED", "PENDING"] }, fromDate: { lte: session.endDate }, toDate: { gte: session.startDate } },
      select: { category: true, status: true, fromDate: true, toDate: true, overLimitDates: true },
    }),
    workingDates(schoolId, from, to),
  ]);
  const base = who?.leavePolicy ? policyDays(who.leavePolicy.days) : allowances[applicant];
  const extra = new Map(extras.map((x) => [x.category, x.days]));
  const workSet = new Set(working);
  const rows: BalanceRow[] = LEAVE_CATEGORIES.map((category) => {
    const b = base[category];
    const x = extra.get(category) ?? 0;
    return { category, allowed: b == null ? null : Math.max(0, b + x), extra: b == null ? 0 : x, used: 0, pending: 0 };
  });
  for (const r of requests) {
    // Days over the monthly cap are absent, not leave.
    const days = datesBetween(isoDate(r.fromDate), isoDate(r.toDate)).filter((d) => workSet.has(d) && !r.overLimitDates.includes(d)).length;
    const row = rows.find((x) => x.category === r.category)!;
    if (r.status === "APPROVED") row.used += days;
    else row.pending += days;
  }
  return { session: session.name, policy: who?.leavePolicy ? { id: who.leavePolicy.id, name: who.leavePolicy.name } : null, rows };
}

export type LeaveBalance = Awaited<ReturnType<typeof leaveBalance>>;

/** Weekly offs and holidays from today to the session's end, so the leave form can count working days. */
export async function upcomingDaysOff(schoolId: string, today: string) {
  const session = await getCurrentSession(schoolId);
  const end = isoDate(session.endDate);
  return today > end ? [] : [...(await daysOff(schoolId, today, end)).keys()];
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
  // Days over the monthly cap: saved once approved; for a waiting request, what approving now would give.
  let overLimit = v.overLimit;
  let monthlyCap: number | null = null;
  if (v.applicant !== "STUDENT") {
    const cap = (await loadLeaveRules(actor.schoolId)).monthly[v.applicant][v.category];
    monthlyCap = cap ?? null;
    if (v.status === "PENDING" && cap != null) {
      const usage = await monthUsage(actor.schoolId, v.applicant, v.personId, v.from.slice(0, 7), v.to.slice(0, 7));
      const used = Object.fromEntries(Object.entries(usage[v.category] ?? {}).map(([m, u]) => [m, u.counted]));
      overLimit = splitByMonthlyCap(working, cap, used).over;
    }
  }
  return {
    ...v,
    overLimit,
    monthlyCap,
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
  return logged("Leave", { ok: true, message: `Approved ${ok} request${ok === 1 ? "" : "s"}${failed.length ? `; ${failed.length} couldn't be approved` : ""}.` });
}

/** Whether the actor may see this request (and its attachment). */
export async function canSeeLeave(actor: LeaveActor, id: string) {
  return (await db.leaveRequest.count({ where: { AND: [visibleWhere(actor), { id }] } })) > 0;
}
