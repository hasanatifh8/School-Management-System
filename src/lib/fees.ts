import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { MODE_LABELS, MONTH_NAMES, deskMonths, dueKey, dueTotals, headAmount, rupees, stopFare, studentDues, type DueItem, type FeeHeadInfo } from "@/lib/fees-shared";
import { getPortalSchool, getViewer } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { ensureTransportFee } from "@/lib/transport-fees";

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
  // Bus riders pay their stop's fare through a fee the school never sets up by hand.
  await ensureTransportFee(school.id, session.id);
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
    transport: h.transport,
    dueDay: h.dueDay,
    dueMonth: h.dueMonth,
    lateFee: h.lateFee,
    lateFeeMonthly: h.lateFeeMonthly,
    sortOrder: h.sortOrder,
    amounts: Object.fromEntries(h.amounts.map((a) => [a.classId, a.amount])),
  }));
}

/**
 * Rupees paid, discounted and late fees per instalment (dueKey) by each student
 * for the session's fees, ignoring cancelled receipts. A payment counts towards
 * the session of the fee it paid, so arrears paid in a later session settle it.
 */
async function paidByStudent(sessionId: string, studentIds?: string[]) {
  const items = await db.feeReceiptItem.findMany({
    where: {
      head: { sessionId },
      receipt: { cancelledAt: null, ...(studentIds ? { studentId: { in: studentIds } } : { studentId: { not: null } }) },
    },
    select: { headId: true, period: true, amount: true, discount: true, lateFee: true, charged: true, receipt: { select: { studentId: true } } },
  });
  /** The price each instalment was paid at (the latest payment's), so it isn't repriced later. */
  const priced = new Map<string, Map<string, number>>();
  const paid = new Map<string, Map<string, number>>();
  const discounts = new Map<string, Map<string, number>>();
  const lateFees = new Map<string, Map<string, number>>();
  const add = (map: Map<string, Map<string, number>>, sid: string, k: string, n: number) => {
    if (!map.has(sid)) map.set(sid, new Map());
    map.get(sid)!.set(k, (map.get(sid)!.get(k) ?? 0) + n);
  };
  for (const i of items) {
    const k = dueKey(i.headId!, i.period);
    add(paid, i.receipt.studentId!, k, i.amount);
    if (i.discount) add(discounts, i.receipt.studentId!, k, i.discount);
    if (i.lateFee) add(lateFees, i.receipt.studentId!, k, i.lateFee);
    if (i.charged) {
      if (!priced.has(i.receipt.studentId!)) priced.set(i.receipt.studentId!, new Map());
      priced.get(i.receipt.studentId!)!.set(k, i.charged);
    }
  }
  return { paid, discounts, lateFees, priced };
}

async function optInsByStudent(sessionId: string, studentIds?: string[]) {
  const rows = await db.studentFeeHead.findMany({
    where: { head: { sessionId }, ...(studentIds && { studentId: { in: studentIds } }) },
    select: { studentId: true, headId: true, fromDate: true, toDate: true },
  });
  // Per student, head → first day it is charged from (null = the whole session),
  // and head → last month charged ("2027-01"), when one was set.
  const map = new Map<string, Map<string, string | null>>();
  const until = new Map<string, Map<string, string>>();
  for (const r of rows) {
    if (!map.has(r.studentId)) map.set(r.studentId, new Map());
    map.get(r.studentId)!.set(r.headId, r.fromDate ? isoDate(r.fromDate) : null);
    if (r.toDate) {
      if (!until.has(r.studentId)) until.set(r.studentId, new Map());
      until.get(r.studentId)!.set(r.headId, isoDate(r.toDate).slice(0, 7));
    }
  }
  return Object.assign(map, { until });
}

/** A student's fee account for the current session. */
export async function loadStudentAccount(schoolId: string, studentId: string) {
  const { session, today } = await getFeesAccess();
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    include: { section: { include: { class: true } }, transportRoute: { select: { stops: true, stopFares: true } } },
  });
  if (!student) return null;
  const fare = stopFare(student);
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
    chargeFrom: student.feesFrom ? isoDate(student.feesFrom) : null,
    optIns: optIns.get(student.id) ?? new Map(),
    optUntil: optIns.until.get(student.id),
    transportFare: fare,
    paid: paid.paid.get(student.id) ?? new Map(),
    discounts: paid.discounts.get(student.id),
    lateFeesPaid: paid.lateFees.get(student.id),
    priced: paid.priced.get(student.id),
    backHeadIds: student.feesFromHeadIds,
    session: { start: isoDate(session.startDate), name: session.name },
    today,
  });
  // Last session's unpaid fees, carried in as arrears (they come first, being oldest).
  const arrears = await previousSessionArrears(student, fare, session.startDate, today);
  const classId = student.section?.classId;
  const optionalHeads = heads
    .filter((h) => h.optional && headAmount(h, classId, fare))
    .map((h) => ({
      id: h.id,
      name: h.name,
      amount: headAmount(h, classId, fare)!,
      transport: h.transport,
      frequency: h.frequency,
      added: optIns.get(student.id)?.has(h.id) ?? false,
      /** First month charged ("2026-10"), or null for the whole session. */
      from: optIns.get(student.id)?.get(h.id)?.slice(0, 7) ?? null,
      /** Last month charged ("2027-01"), or null for the end of the session. */
      to: optIns.until.get(student.id)?.get(h.id) ?? null,
      paid: dues.some((d) => d.headId === h.id && d.paid > 0),
    }));
  return {
    student,
    session,
    today,
    heads,
    dues: [...arrears, ...dues],
    totals: dueTotals(dues, today),
    arrearsTotal: arrears.reduce((n, d) => n + d.balance, 0),
    optionalHeads,
    receipts,
  };
}

/**
 * What a student left unpaid in the previous session, in the class they were in
 * then. These instalments can be collected now; a payment settles the old fee.
 */
async function previousSessionArrears(
  student: { id: string; schoolId: string; admissionDate: Date; feesFrom: Date | null; feesFromHeadIds: string[] },
  transportFare: number,
  currentStart: Date,
  today: string,
) {
  const previous = await db.academicSession.findFirst({
    where: { schoolId: student.schoolId, startDate: { lt: currentStart } },
    orderBy: { startDate: "desc" },
  });
  if (!previous) return [];
  const enrollment = await db.enrollment.findFirst({ where: { sessionId: previous.id, studentId: student.id }, include: { section: true } });
  if (!enrollment) return [];
  const [heads, paid, optIns] = await Promise.all([
    loadFeeHeads(previous.id),
    paidByStudent(previous.id, [student.id]),
    optInsByStudent(previous.id, [student.id]),
  ]);
  if (!heads.length) return [];
  const start = isoDate(previous.startDate);
  const end = isoDate(previous.endDate);
  // "Charge from" choices belong to the session they were made in.
  const fromThen = student.feesFrom && isoDate(student.feesFrom) >= start && isoDate(student.feesFrom) <= end;
  return studentDues({
    heads,
    classId: enrollment.section.classId,
    admissionDate: isoDate(student.admissionDate),
    chargeFrom: fromThen ? isoDate(student.feesFrom!) : null,
    backHeadIds: fromThen ? student.feesFromHeadIds : [],
    optIns: optIns.get(student.id) ?? new Map(),
    optUntil: optIns.until.get(student.id),
    transportFare,
    paid: paid.paid.get(student.id) ?? new Map(),
    discounts: paid.discounts.get(student.id),
    lateFeesPaid: paid.lateFees.get(student.id),
    priced: paid.priced.get(student.id),
    session: { start, name: previous.name },
    today,
  })
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, arrears: previous.name, label: `${d.label} · ${previous.name}` }));
}

/** Amount due now (instalments due up to today) for every active student with a class. */
export async function outstandingByStudent(schoolId: string, where: Prisma.StudentWhereInput = {}) {
  const { session, today } = await getFeesAccess();
  const students = await db.student.findMany({
    where: { ...where, schoolId, status: "ACTIVE", sectionId: { not: null } },
    select: {
      id: true,
      admissionDate: true,
      feesFrom: true,
      feesFromHeadIds: true,
      section: { select: { classId: true } },
      transportStop: true,
      transportRoute: { select: { stops: true, stopFares: true } },
    },
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
      chargeFrom: s.feesFrom ? isoDate(s.feesFrom) : null,
      optIns: optIns.get(s.id) ?? new Map(),
      optUntil: optIns.until.get(s.id),
      transportFare: stopFare(s),
      paid: paid.paid.get(s.id) ?? new Map(),
      discounts: paid.discounts.get(s.id),
      lateFeesPaid: paid.lateFees.get(s.id),
      priced: paid.priced.get(s.id),
      backHeadIds: s.feesFromHeadIds,
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
    select: {
      id: true,
      admissionDate: true,
      feesFrom: true,
      feesFromHeadIds: true,
      section: { select: { classId: true } },
      transportStop: true,
      transportRoute: { select: { stops: true, stopFares: true } },
    },
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
      chargeFrom: s.feesFrom ? isoDate(s.feesFrom) : null,
      optIns: optIns.get(s.id) ?? new Map(),
      optUntil: optIns.until.get(s.id),
      transportFare: stopFare(s),
      paid: paid.paid.get(s.id) ?? new Map(),
      discounts: paid.discounts.get(s.id),
      lateFeesPaid: paid.lateFees.get(s.id),
      priced: paid.priced.get(s.id),
      backHeadIds: s.feesFromHeadIds,
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
export type LedgerEntry = {
  date: string;
  kind: "OPENING" | "FEE" | "LATE" | "PAYMENT" | "DISCOUNT" | "WAIVER" | "CANCELLED" | "LATE_DUE";
  particulars: string;
  detail?: string;
  debit: number;
  credit: number;
  /** Running balance after this entry (owed by the student). */
  balance: number;
  receipt?: { id: string; number: string };
};

/**
 * A student's fee ledger for the session, as a statement: every fee charged
 * (on its due date), late fee, payment, discount and waiver in date order with
 * a running balance; plus a month-by-month summary.
 */
export async function loadLedger(schoolId: string, studentId: string) {
  const account = await loadStudentAccount(schoolId, studentId);
  if (!account) return null;
  const { dues, session, today } = account;
  const receipts = await db.feeReceipt.findMany({
    where: { studentId, schoolId, sessionId: session.id },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { items: { select: { headId: true, period: true, amount: true, discount: true, lateFee: true } } },
  });
  const arrearsKeys = new Set(dues.filter((d) => d.arrears).map((d) => dueKey(d.headId, d.period)));

  const entries: Omit<LedgerEntry, "balance">[] = [];
  // Opening: last session's fees still owed when this session began.
  const paidOnArrears = receipts
    .filter((r) => !r.cancelledAt)
    .flatMap((r) => r.items)
    .filter((i) => i.headId && arrearsKeys.has(dueKey(i.headId, i.period)))
    .reduce((n, i) => n + i.amount + i.discount, 0);
  const opening = dues.filter((d) => d.arrears).reduce((n, d) => n + d.balance, 0) + paidOnArrears;
  if (opening) {
    entries.push({ date: isoDate(session.startDate), kind: "OPENING", particulars: `Brought forward from ${dues.find((d) => d.arrears)!.arrears}`, debit: opening, credit: 0 });
  }
  // Fees charged on their due dates (those not yet due only if something was paid ahead).
  for (const d of dues) {
    if (d.arrears || (d.due > today && !d.paid && !d.discount)) continue;
    entries.push({ date: d.due, kind: "FEE", particulars: d.headName, detail: d.label, debit: d.amount, credit: 0 });
  }
  for (const r of receipts) {
    const date = isoDate(r.date);
    const receipt = { id: r.id, number: r.number };
    if (r.cancelledAt) {
      entries.push({ date, kind: "CANCELLED", particulars: `Receipt cancelled`, detail: r.cancelReason ?? undefined, debit: 0, credit: 0, receipt });
      continue;
    }
    const late = r.items.reduce((n, i) => n + i.lateFee, 0);
    const discount = r.items.reduce((n, i) => n + i.discount, 0);
    if (late) entries.push({ date, kind: "LATE", particulars: "Late fee", detail: r.lateWaived ? `${rupees(late + r.lateWaived)} due, ${rupees(r.lateWaived)} waived` : undefined, debit: late, credit: 0, receipt });
    if (r.lateWaived) entries.push({ date, kind: "WAIVER", particulars: `Late fee waived · ${rupees(r.lateWaived)}`, detail: `By ${r.collectedBy}`, debit: 0, credit: 0, receipt });
    if (r.total) entries.push({ date, kind: "PAYMENT", particulars: `Payment received · ${MODE_LABELS[r.mode]}`, detail: r.reference ? `Ref ${r.reference}` : undefined, debit: 0, credit: r.total, receipt });
    if (discount) entries.push({ date, kind: "DISCOUNT", particulars: "Discount", detail: r.discountNote ?? undefined, debit: 0, credit: discount, receipt });
  }
  // Late fee owed today on what is still unpaid.
  const lateDue = dues.reduce((n, d) => n + d.lateFee, 0);
  if (lateDue) entries.push({ date: today, kind: "LATE_DUE", particulars: "Late fee due as of today", detail: "On unpaid fees; can be waived when collecting", debit: lateDue, credit: 0 });

  // Date order; on one day, charges before what pays them.
  const order: LedgerEntry["kind"][] = ["OPENING", "FEE", "LATE", "LATE_DUE", "PAYMENT", "DISCOUNT", "WAIVER", "CANCELLED"];
  entries.sort((a, b) => a.date.localeCompare(b.date) || order.indexOf(a.kind) - order.indexOf(b.kind));
  let balance = 0;
  const statement: LedgerEntry[] = entries.map((e) => ({ ...e, balance: (balance += e.debit - e.credit) }));

  const valid = receipts.filter((r) => !r.cancelledAt);
  const sums = {
    fees: dues.filter((d) => !d.arrears).reduce((n, d) => n + d.amount, 0),
    opening,
    lateCharged: valid.reduce((n, r) => n + r.items.reduce((m, i) => m + i.lateFee, 0), 0),
    lateDue,
    lateWaived: valid.reduce((n, r) => n + r.lateWaived, 0),
    discount: valid.reduce((n, r) => n + r.items.reduce((m, i) => m + i.discount, 0), 0),
    paid: valid.reduce((n, r) => n + r.total, 0),
    dueNow: Math.max(0, balance),
    upcoming: dues.filter((d) => d.due > today).reduce((n, d) => n + d.balance, 0),
  };

  const monthPayments = (items: DueItem[]) => {
    const keys = new Set(items.map((d) => dueKey(d.headId, d.period)));
    return valid.flatMap((r) => {
      const parts = r.items.filter((i) => i.headId && keys.has(dueKey(i.headId, i.period)));
      if (!parts.length) return [];
      const sum = (f: (i: (typeof parts)[number]) => number) => parts.reduce((n, i) => n + f(i), 0);
      return [{ id: r.id, number: r.number, date: isoDate(r.date), mode: r.mode, fees: sum((i) => i.amount), late: sum((i) => i.lateFee), discount: sum((i) => i.discount), lateWaived: r.lateWaived, note: r.discountNote }];
    });
  };

  // Month by month: what each month charged, its late fee, discount, payments and what is left.
  const months = deskMonths(dues, isoDate(session.startDate), today)
    .filter((m) => m.items.length)
    .map((m) => ({
      key: m.key,
      label: m.label,
      fees: m.items.map((d) => d.headName),
      // Each fee of the month, and every collection made towards it (the part of each receipt for this month).
      items: m.items.map((d) => ({ name: d.headName, label: d.label, due: d.due, amount: d.amount, paid: d.paid, discount: d.discount, balance: d.balance, lateFeePaid: d.lateFeePaid, lateFee: d.lateFee })),
      payments: monthPayments(m.items),
      charged: m.charged,
      late: m.items.reduce((n, d) => n + d.lateFeePaid, 0),
      lateDue: m.items.reduce((n, d) => n + d.lateFee, 0),
      discount: m.items.reduce((n, d) => n + d.discount, 0),
      paid: m.items.reduce((n, d) => n + d.paid, 0),
      balance: m.balance,
      status: m.status,
    }));

  return { ...account, statement, months, sums };
}

export type Ledger = NonNullable<Awaited<ReturnType<typeof loadLedger>>>;

/** What the student paid this session before a receipt (valid receipts only), for the receipt's summary. */
export async function earlierPayments(receipt: { studentId: string | null; sessionId: string; createdAt: Date }) {
  if (!receipt.studentId) return { count: 0, total: 0 };
  const r = await db.feeReceipt.aggregate({
    where: { studentId: receipt.studentId, sessionId: receipt.sessionId, cancelledAt: null, createdAt: { lt: receipt.createdAt } },
    _sum: { total: true },
    _count: true,
  });
  return { count: r._count, total: r._sum.total ?? 0 };
}
