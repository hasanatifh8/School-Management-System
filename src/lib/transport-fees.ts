import "server-only";
import type { ActionState } from "@/lib/action-state";
import { isoDate, parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/sessions";

const FEE_NAME = "Transport fee";

/**
 * The session's transport fee: each student on a bus pays their stop's monthly
 * fare (set under Transport). It is created on its own, the first time the
 * school has a stop with a fare, with everyone already on a bus added; nobody
 * sets it up in the fee structure. Returns its id, or null while no stop has a fare.
 */
export async function ensureTransportFee(schoolId: string, sessionId: string): Promise<string | null> {
  const existing = await db.feeHead.findFirst({ where: { sessionId, transport: true }, select: { id: true } });
  if (existing) return existing.id;
  const routes = await db.transportRoute.findMany({ where: { schoolId }, select: { stopFares: true } });
  if (!routes.some((r) => r.stopFares.some((f) => f > 0))) return null;

  const session = await db.academicSession.findUniqueOrThrow({ where: { id: sessionId }, select: { startDate: true } });
  const month = `${todayISO().slice(0, 7)}-01`;
  // Riders pay from this month, or the whole session if it hasn't started yet.
  const fromDate = isoDate(session.startDate) >= month ? null : parseISODate(month);
  // Carry over how the school set it up last time: name, due day and late fee.
  const last = await db.feeHead.findFirst({
    where: { schoolId, transport: true, sessionId: { not: sessionId } },
    orderBy: { session: { startDate: "desc" } },
    select: { name: true, dueDay: true, lateFee: true, lateFeeMonthly: true },
  });
  const name = last?.name ?? FEE_NAME;
  const taken = await db.feeHead.findFirst({ where: { sessionId, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  try {
    return await db.$transaction(async (tx) => {
      const head = await tx.feeHead.create({
        data: {
          schoolId,
          sessionId,
          name: taken ? `${name} (bus)` : name,
          frequency: "MONTHLY",
          dueDay: last?.dueDay ?? 10,
          lateFee: last?.lateFee ?? 0,
          lateFeeMonthly: last?.lateFeeMonthly ?? true,
          optional: true,
          transport: true,
          sortOrder: (await tx.feeHead.count({ where: { sessionId } })) + 1,
        },
      });
      const riders = await tx.student.findMany({
        where: { schoolId, status: "ACTIVE", transportRouteId: { not: null }, transportStop: { not: null } },
        select: { id: true },
      });
      await tx.studentFeeHead.createMany({ data: riders.map((r) => ({ studentId: r.id, headId: head.id, fromDate })), skipDuplicates: true });
      return head.id;
    });
  } catch {
    // Created at the same moment by another request.
    return (await db.feeHead.findFirst({ where: { sessionId, transport: true }, select: { id: true } }))?.id ?? null;
  }
}

/**
 * Keeps a student's transport fee in step with their bus: on a bus, they pay
 * their stop's fare every month from `fromDate`; off it, they stop paying,
 * unless payments were already taken towards it (then it stays, to be sorted on the fee page).
 */
export async function syncTransportFee(schoolId: string, studentId: string, sessionId: string, onBus: boolean, range: FeeRange) {
  const headId = await ensureTransportFee(schoolId, sessionId);
  if (!headId) return;
  if (onBus) {
    const months = { fromDate: range.from, toDate: range.to };
    await db.studentFeeHead.upsert({ where: { studentId_headId: { studentId, headId } }, create: { studentId, headId, ...months }, update: months });
    return;
  }
  const paid = await db.feeReceiptItem.count({ where: { headId, receipt: { studentId, cancelledAt: null } } });
  if (!paid) await db.studentFeeHead.deleteMany({ where: { studentId, headId } });
}

/**
 * The fee months from a form's `feeFrom` / `feeTo` ("2026-08", or blank for
 * from admission / to the session end), kept to months of the session.
 */
export function readFeeRange(formData: FormData, sessionMonths: string[]): FeeRange {
  const month = (name: string) => {
    const m = String(formData.get(name) ?? "");
    return sessionMonths.includes(m) ? parseISODate(`${m}-01`) : null;
  };
  return { from: month("feeFrom"), to: month("feeTo") };
}

/** The months a transport fee is charged: from (null = from admission) to (null = the end of the session), first days. */
export type FeeRange = { from: Date | null; to: Date | null };

/**
 * Puts a student on a route and stop, or (no route) takes them off transport,
 * and starts or stops their transport fee to match, for the months in `range`.
 */
export async function assignStudentTransport(schoolId: string, studentId: string, routeId: string, stop: string, range: FeeRange): Promise<ActionState> {
  const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
  if (!student) return { error: "Student not found." };
  if (range.from && range.to && range.to < range.from) return { error: "The last month can't be before the first.", fieldErrors: { feeTo: ["Before the first month"] } };
  const session = await getCurrentSession(schoolId);
  if (!routeId) {
    await db.student.update({ where: { id: studentId }, data: { transportRouteId: null, transportStop: null } });
    await syncTransportFee(schoolId, studentId, session.id, false, range);
    return { ok: true, message: "Taken off school transport." };
  }
  const route = await db.transportRoute.findFirst({ where: { id: routeId, schoolId } });
  if (!route) return { error: "Route not found." };
  if (route.stops.length && !route.stops.includes(stop)) return { error: "Choose the student's stop.", fieldErrors: { stop: ["Choose a stop"] } };
  await db.student.update({ where: { id: studentId }, data: { transportRouteId: route.id, transportStop: stop || null } });
  await syncTransportFee(schoolId, studentId, session.id, !!stop, range);
  return { ok: true, message: `Assigned to route ${route.routeNumber}${stop ? `, ${stop}` : ""}.` };
}
