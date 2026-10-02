import "server-only";
// Leave requests for students, teachers and staff.
//
// Who may do what:
//  - school admins: enter a request for anyone, and approve or reject any request;
//  - a teacher: apply for their own leave, and enter, approve or reject
//    requests for students of the section they are class teacher of.
// Approving a request turns "Absent" already marked in the leave dates into
// "Leave"; attendance taken later starts those people on leave.
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { type ActionState, validationError } from "@/lib/action-state";
import { isoDate, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import {
  APPLICANT_LABELS,
  LEAVE_APPLICANTS,
  LEAVE_CATEGORIES,
  LEAVE_STATUSES,
  MAX_LEAVE_DAYS,
  leaveDays,
  type LeaveApplicantKey,
  type LeavePerson,
  type LeaveStatusKey,
} from "@/lib/leave-shared";
import { paginate } from "@/lib/pagination";
import { fullName, sectionLabel } from "@/lib/queries";
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
      ...(ctx.classSection ? [{ applicant: "STUDENT" as const, student: { sectionId: ctx.classSection.id } }] : []),
    ],
  };
}

/** Whether the actor may approve or reject this request. Nobody decides their own. */
function canDecide(actor: LeaveActor, r: { applicant: LeaveApplicantKey; teacherId: string | null; student: { sectionId: string | null } | null }) {
  if (actor.kind === "admin") return true;
  return r.applicant === "STUDENT" && !!actor.ctx.classSection && r.student?.sectionId === actor.ctx.classSection.id;
}

const include = {
  student: { select: { id: true, firstName: true, middleName: true, lastName: true, sectionId: true, section: { include: { class: true } } } },
  teacher: { select: { id: true, firstName: true, middleName: true, lastName: true, employeeCode: true } },
  staff: { select: { id: true, name: true, designation: true, employeeCode: true } },
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
  const [total, counts] = await Promise.all([
    db.leaveRequest.count({ where }),
    db.leaveRequest.groupBy({ by: ["status"], where: { AND: [base, whoWhere] }, _count: true }),
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
  return { rows: rows.map((r) => view(actor, r)), paging, byStatus };
}

/* ───────────────────────── Who a request can be for ───────────────────────── */

/** People the actor may enter a request for (a teacher also always applies for themselves). */
export async function leavePeople(actor: LeaveActor): Promise<LeavePerson[]> {
  const sectionWhere = actor.kind === "teacher" ? (actor.ctx.classSection ? { sectionId: actor.ctx.classSection.id } : { id: "" }) : {};
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

/** An approved leave turns "Absent" already marked in its dates into "Leave". */
async function applyApprovedLeave(r: { schoolId: string; studentId: string | null; teacherId: string | null; staffId: string | null; fromDate: Date; toDate: Date }) {
  const dates = { gte: r.fromDate, lte: r.toDate };
  if (r.studentId) {
    await db.attendanceRecord.updateMany({ where: { studentId: r.studentId, status: "ABSENT", day: { date: dates } }, data: { status: "LEAVE" } });
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

/* ───────────────────────── For attendance ───────────────────────── */

/** Ids of people (students, or teachers / staff) on approved leave on a date. */
export async function onLeave(schoolId: string, date: Date) {
  const rows = await db.leaveRequest.findMany({
    where: { schoolId, status: "APPROVED", fromDate: { lte: date }, toDate: { gte: date } },
    select: { studentId: true, teacherId: true, staffId: true },
  });
  return new Set(rows.flatMap((r) => [r.studentId, r.teacherId, r.staffId]).filter((x): x is string => !!x));
}
