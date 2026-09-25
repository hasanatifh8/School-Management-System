import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { dueKey, dueTotals, studentDues, type FeeHeadInfo } from "@/lib/fees-shared";
import { getPortalSchool, getViewer } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Access check for the Fees section: Power Admin, school admins and fees staff
 * (accountants). `canManage` (fee structure, cancelling receipts) is for
 * admins only. Anyone else is sent to /login.
 */
export const getFeesAccess = cache(async () => {
  const school = await getPortalSchool();
  const viewer = (await getViewer())!;
  const session = await getCurrentSession(school.id);
  const staff = viewer.kind === "admin" ? viewer.admin : null;
  return {
    school,
    session,
    canManage: !staff || staff.role === "ADMIN",
    who: staff ? `${staff.name}${staff.role === "ADMIN" ? "" : " (accounts)"}` : "Power Admin",
    today: todayISO(),
  };
});

/** Same as getFeesAccess, but only for admins (fee structure, cancelling receipts). */
export async function requireFeesManager() {
  const access = await getFeesAccess();
  if (!access.canManage) redirect("/admin/fees");
  return access;
}

export async function loadFeeHeads(sessionId: string): Promise<(FeeHeadInfo & { sortOrder: number })[]> {
  const heads = await db.feeHead.findMany({
    where: { sessionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { amounts: true },
  });
  return heads.map((h) => ({
    id: h.id,
    name: h.name,
    frequency: h.frequency,
    optional: h.optional,
    dueDay: h.dueDay,
    dueMonth: h.dueMonth,
    sortOrder: h.sortOrder,
    amounts: Object.fromEntries(h.amounts.map((a) => [a.classId, a.amount])),
  }));
}

/** Rupees paid per instalment (dueKey) by each student this session, ignoring cancelled receipts. */
async function paidByStudent(sessionId: string, studentIds?: string[]) {
  const items = await db.feeReceiptItem.findMany({
    where: {
      headId: { not: null },
      receipt: { sessionId, cancelledAt: null, ...(studentIds ? { studentId: { in: studentIds } } : { studentId: { not: null } }) },
    },
    select: { headId: true, period: true, amount: true, receipt: { select: { studentId: true } } },
  });
  const map = new Map<string, Map<string, number>>();
  for (const i of items) {
    const sid = i.receipt.studentId!;
    if (!map.has(sid)) map.set(sid, new Map());
    const m = map.get(sid)!;
    const k = dueKey(i.headId!, i.period);
    m.set(k, (m.get(k) ?? 0) + i.amount);
  }
  return map;
}

async function optInsByStudent(sessionId: string, studentIds?: string[]) {
  const rows = await db.studentFeeHead.findMany({
    where: { head: { sessionId }, ...(studentIds && { studentId: { in: studentIds } }) },
    select: { studentId: true, headId: true },
  });
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.studentId)) map.set(r.studentId, new Set());
    map.get(r.studentId)!.add(r.headId);
  }
  return map;
}

/** A student's fee account for the current session. */
export async function loadStudentAccount(schoolId: string, studentId: string) {
  const { session, today } = await getFeesAccess();
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    include: { section: { include: { class: true } } },
  });
  if (!student) return null;
  const [heads, paid, optIns, receipts] = await Promise.all([
    loadFeeHeads(session.id),
    paidByStudent(session.id, [student.id]),
    optInsByStudent(session.id, [student.id]),
    db.feeReceipt.findMany({
      where: { studentId: student.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { session: { select: { name: true } } },
    }),
  ]);
  const dues = studentDues({
    heads,
    classId: student.section?.classId ?? null,
    admissionDate: isoDate(student.admissionDate),
    optIns: optIns.get(student.id) ?? new Set(),
    paid: paid.get(student.id) ?? new Map(),
    session: { start: isoDate(session.startDate), name: session.name },
    today,
  });
  const classId = student.section?.classId;
  const optionalHeads = heads
    .filter((h) => h.optional && classId && h.amounts[classId])
    .map((h) => ({
      id: h.id,
      name: h.name,
      amount: h.amounts[classId!],
      frequency: h.frequency,
      added: optIns.get(student.id)?.has(h.id) ?? false,
      paid: dues.some((d) => d.headId === h.id && d.paid > 0),
    }));
  return { student, session, today, heads, dues, totals: dueTotals(dues, today), optionalHeads, receipts };
}

/** Amount due now (instalments due up to today) for every active student with a class. */
export async function outstandingByStudent(schoolId: string, where: Prisma.StudentWhereInput = {}) {
  const { session, today } = await getFeesAccess();
  const students = await db.student.findMany({
    where: { ...where, schoolId, status: "ACTIVE", sectionId: { not: null } },
    select: { id: true, admissionDate: true, section: { select: { classId: true } } },
  });
  const ids = students.map((s) => s.id);
  const [heads, paid, optIns] = await Promise.all([
    loadFeeHeads(session.id),
    paidByStudent(session.id, ids),
    optInsByStudent(session.id, ids),
  ]);
  const result = new Map<string, { dueNow: number; paid: number; total: number }>();
  for (const s of students) {
    const dues = studentDues({
      heads,
      classId: s.section!.classId,
      admissionDate: isoDate(s.admissionDate),
      optIns: optIns.get(s.id) ?? new Set(),
      paid: paid.get(s.id) ?? new Map(),
      session: { start: isoDate(session.startDate), name: session.name },
      today,
    });
    const t = dueTotals(dues, today);
    result.set(s.id, { dueNow: t.dueNow, paid: t.paid, total: t.total });
  }
  return result;
}

/** Next receipt number for the session, e.g. "2026-27/0001". */
export async function nextReceiptNumber(tx: Prisma.TransactionClient, schoolId: string, sessionName: string) {
  const counter = await tx.counter.upsert({
    where: { schoolId_key: { schoolId, key: `receipt:${sessionName}` } },
    create: { schoolId, key: `receipt:${sessionName}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${sessionName}/${String(counter.value).padStart(4, "0")}`;
}
