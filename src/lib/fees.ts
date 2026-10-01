import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { MONTH_NAMES, dueKey, dueTotals, studentDues, type FeeHeadInfo } from "@/lib/fees-shared";
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
    who: staff ? `${staff.name}${staff.role === "ADMIN" ? "" : " (cashier)"}` : "Power Admin",
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

/**
 * Rupees paid and discounted per instalment (dueKey) by each student this
 * session, ignoring cancelled receipts.
 */
async function paidByStudent(sessionId: string, studentIds?: string[]) {
  const items = await db.feeReceiptItem.findMany({
    where: {
      headId: { not: null },
      receipt: { sessionId, cancelledAt: null, ...(studentIds ? { studentId: { in: studentIds } } : { studentId: { not: null } }) },
    },
    select: { headId: true, period: true, amount: true, discount: true, receipt: { select: { studentId: true } } },
  });
  const paid = new Map<string, Map<string, number>>();
  const discounts = new Map<string, Map<string, number>>();
  const add = (map: Map<string, Map<string, number>>, sid: string, k: string, n: number) => {
    if (!map.has(sid)) map.set(sid, new Map());
    map.get(sid)!.set(k, (map.get(sid)!.get(k) ?? 0) + n);
  };
  for (const i of items) {
    const k = dueKey(i.headId!, i.period);
    add(paid, i.receipt.studentId!, k, i.amount);
    if (i.discount) add(discounts, i.receipt.studentId!, k, i.discount);
  }
  return { paid, discounts };
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
    paid: paid.paid.get(student.id) ?? new Map(),
    discounts: paid.discounts.get(student.id),
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
      paid: paid.paid.get(s.id) ?? new Map(),
      discounts: paid.discounts.get(s.id),
      session: { start: isoDate(session.startDate), name: session.name },
      today,
    });
    const t = dueTotals(dues, today);
    result.set(s.id, { dueNow: t.dueNow, paid: t.paid, total: t.total });
  }
  return result;
}

/**
 * Running totals for each month of the session up to this month: fees falling
 * due (every active student with a class) and fees collected. The gap is what
 * is still pending.
 */
export async function monthlyFeeTrend(schoolId: string) {
  const { session, today } = await getFeesAccess();
  const start = isoDate(session.startDate);
  const students = await db.student.findMany({
    where: { schoolId, status: "ACTIVE", sectionId: { not: null } },
    select: { id: true, admissionDate: true, section: { select: { classId: true } } },
  });
  const ids = students.map((s) => s.id);
  const [heads, paid, optIns, receipts] = await Promise.all([
    loadFeeHeads(session.id),
    paidByStudent(session.id, ids),
    optInsByStudent(session.id, ids),
    db.feeReceipt.findMany({ where: { schoolId, sessionId: session.id, cancelledAt: null }, select: { date: true, total: true } }),
  ]);

  const due = new Map<string, number>();
  for (const s of students) {
    const items = studentDues({
      heads,
      classId: s.section!.classId,
      admissionDate: isoDate(s.admissionDate),
      optIns: optIns.get(s.id) ?? new Set(),
      paid: paid.paid.get(s.id) ?? new Map(),
      discounts: paid.discounts.get(s.id),
      session: { start, name: session.name },
      today,
    });
    // Discounts are waived, so they are not counted as due.
    for (const i of items) due.set(i.due.slice(0, 7), (due.get(i.due.slice(0, 7)) ?? 0) + i.amount - i.discount);
  }
  const collected = new Map<string, number>();
  for (const r of receipts) {
    const m = isoDate(r.date).slice(0, 7);
    collected.set(m, (collected.get(m) ?? 0) + r.total);
  }

  const months: { month: string; label: string; due: number; collected: number }[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  let dueSum = 0;
  let collectedSum = 0;
  for (let i = 0; i < 12; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > today.slice(0, 7)) break;
    dueSum += due.get(key) ?? 0;
    collectedSum += collected.get(key) ?? 0;
    months.push({ month: key, label: MONTH_NAMES[m - 1], due: dueSum, collected: collectedSum });
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return months;
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

/**
 * A student's fee ledger: every instalment of the current session with what
 * was charged, discounted, paid and is still pending, plus the receipts that
 * paid it; and every receipt across sessions as the payment history.
 */
export async function loadLedger(schoolId: string, studentId: string) {
  const account = await loadStudentAccount(schoolId, studentId);
  if (!account) return null;
  const items = await db.feeReceiptItem.findMany({
    where: { headId: { not: null }, receipt: { studentId, sessionId: account.session.id, cancelledAt: null } },
    select: { headId: true, period: true, receipt: { select: { id: true, number: true, date: true } } },
    orderBy: { receipt: { date: "asc" } },
  });
  const payments = new Map<string, { id: string; number: string; date: string }[]>();
  for (const i of items) {
    const k = dueKey(i.headId!, i.period);
    const list = payments.get(k) ?? [];
    if (!list.some((p) => p.id === i.receipt.id)) list.push({ id: i.receipt.id, number: i.receipt.number, date: isoDate(i.receipt.date) });
    payments.set(k, list);
  }
  const rows = account.dues.map((d) => ({ ...d, payments: payments.get(dueKey(d.headId, d.period)) ?? [] }));
  const history = await db.feeReceipt.findMany({
    where: { studentId, schoolId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { session: { select: { name: true } }, items: { select: { discount: true } } },
  });
  return {
    ...account,
    rows,
    history: history.map((r) => ({
      id: r.id,
      number: r.number,
      date: isoDate(r.date),
      session: r.session.name,
      mode: r.mode,
      paid: r.total,
      discount: r.items.reduce((n, i) => n + i.discount, 0),
      cancelled: !!r.cancelledAt,
    })),
  };
}

export type Ledger = NonNullable<Awaited<ReturnType<typeof loadLedger>>>;
