"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { type ReceiptLine, receiptLine, saveReceipt } from "@/lib/fee-receipts";
import { getFeesAccess, loadStudentAccount, requireFeesManager } from "@/lib/fees";
import { FREQUENCIES, PAYMENT_MODES, dueKey, rupees, monthLabel, sessionMonths } from "@/lib/fees-shared";

const MAX_AMOUNT = 10_000_000; // ₹1 crore per instalment is plenty

/* ───────────────────────── Fee structure (admins) ───────────────────────── */

const headSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the fee name").max(60),
    frequency: z.enum(FREQUENCIES, "Choose how often it is charged"),
    optional: z.literal("on").optional(),
    dueDay: z.coerce.number().int().min(1, "1–28").max(28, "Choose a day from 1 to 28"),
    dueMonth: z.coerce.number().int().min(1).max(12).optional(),
    lateFee: z
      .string()
      .optional()
      .transform((v) => (v ?? "").replace(/[,\s₹]/g, ""))
      .refine((v) => !v || (/^\d{1,6}$/.test(v) && Number(v) <= MAX_AMOUNT), "Whole rupees only")
      .transform((v) => (v ? Number(v) : 0)),
  })
  .transform((v) => ({ ...v, optional: v.optional === "on", dueMonth: v.frequency === "YEARLY" ? (v.dueMonth ?? 4) : null }));

/** Class amounts from fields named `amount:<classId>`; blank means the class isn't charged. */
function readAmounts(formData: FormData, classIds: Set<string>) {
  const amounts: { classId: string; amount: number }[] = [];
  const errors: Record<string, string[]> = {};
  for (const [key, raw] of formData) {
    if (!key.startsWith("amount:")) continue;
    const classId = key.slice(7);
    const text = String(raw).replace(/[,\s₹]/g, "");
    if (!text || !classIds.has(classId)) continue;
    const n = Number(text);
    if (!Number.isInteger(n) || n < 0 || n > MAX_AMOUNT) errors[key] = ["Whole rupees only"];
    else if (n > 0) amounts.push({ classId, amount: n });
  }
  return { amounts, errors };
}

export async function saveFeeHead(headId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, session } = await requireFeesManager();
  const parsed = headSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const classes = await db.schoolClass.findMany({ where: { schoolId: school.id }, select: { id: true } });
  const { amounts, errors } = readAmounts(formData, new Set(classes.map((c) => c.id)));
  if (Object.keys(errors).length) return { error: "Amounts must be whole rupees.", fieldErrors: errors };
  if (!amounts.length) return { error: "Enter the amount for at least one class." };

  const existing = headId ? await db.feeHead.findFirst({ where: { id: headId, sessionId: session.id } }) : null;
  if (headId && !existing) return { error: "Fee not found." };
  const clash = await db.feeHead.findFirst({
    where: { sessionId: session.id, name: { equals: parsed.data.name, mode: "insensitive" }, ...(headId && { id: { not: headId } }) },
  });
  if (clash) return { error: `“${clash.name}” already exists.`, fieldErrors: { name: ["Already used"] } };
  if (existing && existing.frequency !== parsed.data.frequency) {
    const paid = await db.feeReceiptItem.count({ where: { headId: existing.id } });
    if (paid) return { error: "Payments were already taken for this fee, so how often it is charged can't change. Create a new fee instead." };
  }

  await db.$transaction(async (tx) => {
    const head = existing
      ? await tx.feeHead.update({ where: { id: existing.id }, data: parsed.data })
      : await tx.feeHead.create({
          data: {
            ...parsed.data,
            schoolId: school.id,
            sessionId: session.id,
            sortOrder: (await tx.feeHead.count({ where: { sessionId: session.id } })) + 1,
          },
        });
    await tx.feeAmount.deleteMany({ where: { headId: head.id } });
    await tx.feeAmount.createMany({ data: amounts.map((a) => ({ ...a, headId: head.id })) });
  });
  revalidatePath("/admin/fees", "layout");
  redirect("/admin/fees/structure");
}

export async function deleteFeeHead(headId: string): Promise<ActionState> {
  const { session } = await requireFeesManager();
  const head = await db.feeHead.findFirst({ where: { id: headId, sessionId: session.id } });
  if (!head) return { error: "Fee not found." };
  if (await db.feeReceiptItem.count({ where: { headId } })) {
    return { error: `Payments were taken for “${head.name}”, so it can't be deleted. Remove its class amounts instead to stop charging it.` };
  }
  await db.feeHead.delete({ where: { id: headId } });
  revalidatePath("/admin/fees", "layout");
  return { ok: true, message: `Deleted “${head.name}”.` };
}

/** Copies the fee heads and amounts of the most recent earlier session into the current one. */
export async function copyPreviousStructure(): Promise<ActionState> {
  const { school, session } = await requireFeesManager();
  if (await db.feeHead.count({ where: { sessionId: session.id } })) return { error: "This session already has fees." };
  const previous = await db.academicSession.findFirst({
    where: { schoolId: school.id, id: { not: session.id }, startDate: { lt: session.startDate }, feeHeads: { some: {} } },
    orderBy: { startDate: "desc" },
    include: { feeHeads: { include: { amounts: true } } },
  });
  if (!previous) return { error: "No earlier session has fees to copy." };
  await db.$transaction(async (tx) => {
    for (const h of previous.feeHeads) {
      await tx.feeHead.create({
        data: {
          schoolId: school.id,
          sessionId: session.id,
          name: h.name,
          frequency: h.frequency,
          optional: h.optional,
          dueDay: h.dueDay,
          dueMonth: h.dueMonth,
          lateFee: h.lateFee,
          sortOrder: h.sortOrder,
          amounts: { create: h.amounts.map((a) => ({ classId: a.classId, amount: a.amount })) },
        },
      });
    }
  });
  revalidatePath("/admin/fees", "layout");
  return { ok: true, message: `Copied ${previous.feeHeads.length} fees from ${previous.name}. Check the amounts before collecting.` };
}

/* ───────────────────────── Collecting (admins and fees staff) ───────────────────────── */

/** Adds a student to an optional fee (e.g. transport), or removes them if nothing is paid. */
export async function setOptionalFee(studentId: string, headId: string, add: boolean): Promise<ActionState> {
  const { school, session } = await getFeesAccess();
  const [student, head] = await Promise.all([
    db.student.findFirst({ where: { id: studentId, schoolId: school.id }, select: { id: true } }),
    db.feeHead.findFirst({ where: { id: headId, sessionId: session.id, optional: true } }),
  ]);
  if (!student || !head) return { error: "Not found." };
  if (add) {
    await db.studentFeeHead.upsert({ where: { studentId_headId: { studentId, headId } }, create: { studentId, headId, fromDate: thisMonth() }, update: {} });
  } else {
    const paid = await db.feeReceiptItem.count({ where: { headId, receipt: { studentId, cancelledAt: null } } });
    if (paid) return { error: `Payments were taken for ${head.name}; cancel those receipts first to remove it.` };
    await db.studentFeeHead.deleteMany({ where: { studentId, headId } });
  }
  revalidatePath("/admin/fees", "layout");
  return { ok: true, message: add ? `${head.name} added.` : `${head.name} removed.` };
}

/** Charges an opt-in fee (e.g. sports) to the ticked students. */
export async function addOptionalFeeStudents(headId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, session } = await getFeesAccess();
  const head = await db.feeHead.findFirst({
    where: { id: headId, sessionId: session.id, optional: true },
    include: { amounts: { where: { amount: { gt: 0 } }, select: { classId: true } } },
  });
  if (!head) return { error: "Fee not found." };
  const ids = formData.getAll("studentIds").map(String);
  if (!ids.length) return { error: "Select at least one student." };

  // Only students in a class this fee has an amount for; anyone else wouldn't be charged.
  const students = await db.student.findMany({
    where: {
      id: { in: ids },
      schoolId: school.id,
      status: "ACTIVE",
      section: { classId: { in: head.amounts.map((a) => a.classId) } },
    },
    select: { id: true },
  });
  const { count } = await db.studentFeeHead.createMany({
    data: students.map((s) => ({ studentId: s.id, headId, fromDate: thisMonth() })),
    skipDuplicates: true,
  });
  revalidatePath("/admin/fees", "layout");
  const skipped = ids.length - students.length;
  return {
    ok: true,
    message: `${head.name} added for ${count} student(s).${skipped ? ` ${skipped} skipped: no amount is set for their class.` : ""}`,
  };
}

/** Stops charging an opt-in fee to the ticked students, keeping anyone who has already paid towards it. */
export async function removeOptionalFeeStudents(headId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, session } = await getFeesAccess();
  const head = await db.feeHead.findFirst({ where: { id: headId, sessionId: session.id, optional: true } });
  if (!head) return { error: "Fee not found." };
  const ids = formData.getAll("studentIds").map(String);
  if (!ids.length) return { error: "Select at least one student." };

  const paid = await db.feeReceiptItem.findMany({
    where: { headId, receipt: { studentId: { in: ids }, cancelledAt: null } },
    select: { receipt: { select: { studentId: true } } },
  });
  const keep = new Set(paid.map((p) => p.receipt.studentId));
  const { count } = await db.studentFeeHead.deleteMany({
    where: { headId, studentId: { in: ids.filter((id) => !keep.has(id)) }, student: { schoolId: school.id } },
  });
  revalidatePath("/admin/fees", "layout");
  return {
    ok: true,
    message: `${head.name} removed for ${count} student(s).${keep.size ? ` ${keep.size} kept: payments were already taken (cancel those receipts first).` : ""}`,
  };
}

/** First day of this month (India), where a newly added opt-in fee starts. */
const thisMonth = () => parseISODate(`${todayISO().slice(0, 7)}-01`)!;

/** The month an opt-in fee (e.g. transport) starts for a student; blank = the whole session. */
export async function setOptionalFeeFrom(studentId: string, headId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, session } = await getFeesAccess();
  const row = await db.studentFeeHead.findFirst({ where: { studentId, headId, student: { schoolId: school.id }, head: { sessionId: session.id } }, include: { head: true } });
  if (!row) return { error: "This student isn't on that fee." };
  const month = String(formData.get("from") ?? "");
  if (month && !sessionMonths(session.startDate.toISOString().slice(0, 10)).includes(month)) return { error: "Choose a month of this session." };
  await db.studentFeeHead.update({ where: { studentId_headId: { studentId, headId } }, data: { fromDate: month ? parseISODate(`${month}-01`) : null } });
  revalidatePath("/admin/fees", "layout");
  return { ok: true, message: `${row.head.name} charged ${month ? `from ${monthLabel(month)}` : "for the whole session"}.` };
}

const paymentSchema = z.object({
  date: z.string().refine((v) => parseISODate(v), "Choose the payment date"),
  mode: z.enum(PAYMENT_MODES, "Choose how it was paid"),
  reference: z.string().trim().max(60).optional().transform((v) => v || null),
  remarks: z.string().trim().max(200).optional().transform((v) => v || null),
});

/** Records a payment against the chosen instalments and creates a numbered receipt. */
export async function collectFee(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getFeesAccess();
  const { school, session, today } = access;
  const account = await loadStudentAccount(school.id, studentId);
  if (!account || account.student.status !== "ACTIVE") return { error: "Student not found." };
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { date, mode, reference, remarks } = parsed.data;
  const sessionStart = session.startDate.toISOString().slice(0, 10);
  if (date > today || date < sessionStart) return { error: `The payment date must be in session ${session.name}, not in the future.`, fieldErrors: { date: ["Out of range"] } };
  if ((mode === "CHEQUE" || mode === "UPI" || mode === "BANK_TRANSFER") && !reference) {
    return { error: "Enter the cheque / UPI / transaction number.", fieldErrors: { reference: ["Required for this payment mode"] } };
  }

  // Each chosen instalment sends "pay:<key>" and, with a discount, "disc:<key>" (its share
  // of the discount). The late fee is worked out here, not taken from the form.
  const waiveLateFee = formData.get("waiveLateFee") === "on";
  const byKey = new Map(account.dues.map((d) => [dueKey(d.headId, d.period), d]));
  const rupeesIn = (name: string) => String(formData.get(name) ?? "").replace(/[,\s₹]/g, "");
  const lines: ReceiptLine[] = [];
  let lateWaived = 0;
  for (const key of new Set([...formData.keys()].filter((k) => k.startsWith("pay:") || k.startsWith("disc:")).map((k) => k.slice(k.indexOf(":") + 1)))) {
    const item = byKey.get(key);
    if (!item) return { error: "One of the chosen fees no longer applies. Reload the page." };
    const [payText, discText] = [rupeesIn(`pay:${key}`), rupeesIn(`disc:${key}`)];
    const amount = payText ? Number(payText) : 0;
    const discount = discText ? Number(discText) : 0;
    if (!Number.isInteger(amount) || amount < 0 || !Number.isInteger(discount) || discount < 0) return { error: `Enter whole rupees for ${item.headName} (${item.label}).` };
    if (amount + discount > item.balance) return { error: `${item.headName} (${item.label}): only ${rupees(item.balance)} is left, including any discount.` };
    if (amount + discount > 0) {
      // Late only if paid after the due date (or admission), going by the payment date entered.
      const due = date > item.lateAfter ? item.lateFeeRate : 0;
      const lateFee = waiveLateFee ? 0 : due;
      if (waiveLateFee) lateWaived += due;
      lines.push(receiptLine(item, amount, discount, lateFee));
    }
  }
  if (!lines.length) return { error: "Choose at least one fee and enter the amount paid." };
  const discounted = lines.some((l) => l.discount > 0);
  const discountNote = String(formData.get("discountNote") ?? "").trim().slice(0, 200) || null;
  if (discounted && (!discountNote || discountNote.length < 3)) {
    return { error: "Say why the discount is given, e.g. sibling or staff ward.", fieldErrors: { discountNote: ["Reason needed for a discount"] } };
  }

  const saved = await saveReceipt({ access, account, lines, date, mode, reference, remarks, discountNote: discounted ? discountNote : null, lateWaived });
  if ("error" in saved) return { error: saved.error };
  const receipt = saved;
  revalidatePath("/admin/fees", "layout");
  redirect(`/admin/fees/receipts/${receipt.id}?new=1`);
}


const cancelSchema = z.object({ reason: z.string().trim().min(3, "Say why it is cancelled").max(200) });

/** Cancels a receipt (admins only). The receipt is kept, marked cancelled, and its amounts become due again. */
export async function cancelReceipt(receiptId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, who } = await requireFeesManager();
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { count } = await db.feeReceipt.updateMany({
    where: { id: receiptId, schoolId: school.id, cancelledAt: null },
    data: { cancelledAt: new Date(), cancelledBy: who, cancelReason: parsed.data.reason },
  });
  if (!count) return { error: "Receipt not found or already cancelled." };
  revalidatePath("/admin/fees", "layout");
  return { ok: true, message: "Receipt cancelled. Its amounts are due again." };
}

/**
 * Which month a student's fees start from: the admission month (blank) or a
 * month the fees staff choose, e.g. the session's first month for a student
 * admitted mid-year who pays the whole year. Admins and fees staff.
 */
export async function setFeesFrom(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, session } = await getFeesAccess();
  const student = await db.student.findFirst({ where: { id: studentId, schoolId: school.id }, select: { id: true } });
  if (!student) return { error: "Student not found." };
  const month = String(formData.get("feesFrom") ?? "");
  if (month && !sessionMonths(session.startDate.toISOString().slice(0, 10)).includes(month)) return { error: "Choose a month of this session." };
  // Which fees apply to the months before admission (all ticked is stored as "all").
  const offered = formData.getAll("offered").map(String);
  const picked = formData.getAll("backHeads").map(String).filter((id) => offered.includes(id));
  if (month && offered.length && !picked.length) return { error: "Tick at least one fee to charge for the months before admission.", fieldErrors: { backHeads: ["Tick a fee"] } };
  const valid = new Set((await db.feeHead.findMany({ where: { sessionId: session.id, id: { in: picked } }, select: { id: true } })).map((h) => h.id));
  const backHeads = picked.length === offered.length ? [] : picked.filter((id) => valid.has(id));
  await db.student.update({ where: { id: studentId }, data: { feesFrom: month ? parseISODate(`${month}-01`) : null, feesFromHeadIds: month ? backHeads : [] } });
  revalidatePath("/admin/fees", "layout");
  return { ok: true, message: month ? `Fees are now charged from ${monthLabel(month)}.` : "Fees are charged from the admission month again." };
}
