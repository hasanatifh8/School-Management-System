"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { type ActionState, validationError } from "@/lib/action-state";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { receiptLine, saveReceipts } from "@/lib/fee-receipts";
import { getFeesAccess, loadStudentAccount, outstandingByStudent } from "@/lib/fees";
import { PAYMENT_MODES, allocateBill, billOf, deskMonths, payBill, rupees } from "@/lib/fees-shared";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";

export type DeskStudent = {
  id: string;
  name: string;
  code: string;
  roll: number | null;
  className: string | null;
  father: string | null;
  phone: string | null;
  photoUrl: string | null;
  dueNow: number;
};

/** Students for the Fee desk's search: by name, ID, father, phone or roll number, or a whole section. */
export async function searchDeskStudents(query: string, sectionId: string | null): Promise<DeskStudent[]> {
  const { school } = await getFeesAccess();
  const q = query.trim().slice(0, 60);
  if (!q && !sectionId) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const where: Prisma.StudentWhereInput = {
    schoolId: school.id,
    status: "ACTIVE",
    ...(sectionId && { sectionId }),
    AND: words.map((w) => ({
      OR: [
        { firstName: { contains: w, mode: "insensitive" as const } },
        { middleName: { contains: w, mode: "insensitive" as const } },
        { lastName: { contains: w, mode: "insensitive" as const } },
        { studentCode: { contains: w, mode: "insensitive" as const } },
        { fatherName: { contains: w, mode: "insensitive" as const } },
        { phone: { contains: w } },
        ...(/^\d{1,3}$/.test(w) ? [{ rollNumber: Number(w) }] : []),
      ],
    })),
  };
  const students = await db.student.findMany({
    where,
    take: sectionId ? 80 : 15,
    orderBy: [{ section: { class: { sortOrder: "asc" } } }, { section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
    include: { section: { include: { class: true } } },
  });
  const dues = students.length ? await outstandingByStudent(school.id, { id: { in: students.map((s) => s.id) } }) : new Map();
  return students.map((s) => ({
    id: s.id,
    name: fullName(s),
    code: s.studentCode,
    roll: s.rollNumber,
    className: s.section ? sectionLabel(s.section) : null,
    father: s.fatherName,
    phone: s.phone,
    photoUrl: photoUrl(s.photoId),
    dueNow: dues.get(s.id)?.dueNow ?? 0,
  }));
}

const quickSchema = z.object({
  discount: z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/[,\s₹]/g, ""))
    .refine((v) => /^\d{0,8}$/.test(v), "Whole rupees only")
    .transform((v) => (v ? Number(v) : 0)),
  discountNote: z.string().trim().max(200).optional().transform((v) => v || null),
  date: z.string().refine((v) => parseISODate(v), "Choose the payment date"),
  mode: z.enum(PAYMENT_MODES, "Choose how it was paid"),
  reference: z.string().trim().max(60).optional().transform((v) => v || null),
  remarks: z.string().trim().max(200).optional().transform((v) => v || null),
  // Amount received; blank = the whole bill. Less is a part payment.
  received: z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/[,\s₹]/g, ""))
    .refine((v) => /^\d{0,8}$/.test(v), "Whole rupees only")
    .transform((v) => (v ? Number(v) : null)),
});

/**
 * The Fee desk's collection: one month's bill. Previous dues carried into it
 * (balances of part-paid earlier months) are settled first, each month on its
 * own add-on receipt tied back to that month; only then are the month's own
 * fees collected, on their own receipt. Less received is a part payment, oldest
 * month first; what a month is not cleared of holds the later ones back.
 * The receipt (the month's own, else the last made) opens next.
 */
export async function quickCollect(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getFeesAccess();
  const { school, session, today } = access;
  const account = await loadStudentAccount(school.id, studentId);
  if (!account || account.student.status !== "ACTIVE") return { error: "Student not found." };
  const parsed = quickSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { discount, discountNote, date, mode, reference, remarks, received } = parsed.data;
  const months = formData.getAll("month").map(String);

  if (date > today || date < session.startDate.toISOString().slice(0, 10)) {
    return { error: `The payment date must be in session ${session.name}, not in the future.`, fieldErrors: { date: ["Out of range"] } };
  }
  // Each month is billed on its own; a part-paid month's balance is collected on the next bill.
  if (months.length !== 1) return { error: "Collect one month at a time." };
  const desk = deskMonths(account.dues, session.startDate.toISOString().slice(0, 10), today);
  const bill = billOf(desk, months[0]);
  if (!bill) return { error: "Month not found." };
  if (bill.movedTo) return { error: `This month's balance is collected on the ${bill.movedTo.label} bill.` };
  if (received != null && received <= 0) return { error: "Enter the amount received.", fieldErrors: { received: ["Enter the amount"] } };
  if ((mode === "CHEQUE" || mode === "UPI" || mode === "BANK_TRANSFER") && !reference) {
    return { error: "Enter the cheque / UPI / transaction number.", fieldErrors: { reference: ["Required for this payment mode"] } };
  }
  if (discount > 0 && (!discountNote || discountNote.length < 3)) {
    return { error: "Say why the discount is given, e.g. sibling or staff ward.", fieldErrors: { discountNote: ["Reason needed for a discount"] } };
  }

  // The bill's late fee ticks: each month's late fee charged (lateOn) or waived (lateOff).
  const lateChoice = Object.fromEntries([
    ...formData.getAll("lateOff").map((k) => [String(k), false] as const),
    ...formData.getAll("lateOn").map((k) => [String(k), true] as const),
  ]);
  // With previous dues on the bill, the month's own fees can be left for later ("own" unticked).
  const own = !bill.carried.length || formData.get("own") === "on";
  const pay = payBill(account.dues, { carried: bill.carried.map((c) => c.key), month: bill.month.key }, {
    own,
    discount,
    waiveLate: formData.get("waiveLate") === "on",
    lateChoice,
    received: received ?? undefined,
    payDate: date,
  });
  if (pay.unusedDiscount > 0) return { error: "The discount is more than this month's fees.", fieldErrors: { discount: ["Too large"] } };
  if (pay.excess > 0) return { error: `That is ${rupees(pay.excess)} more than the bill. Collect ${rupees(pay.full)} at most.`, fieldErrors: { received: ["More than the bill"] } };
  if (!pay.parts.length) return { error: "This bill is already paid. Reload the page." };

  // What a part payment of the month's own fees leaves moves to the next bill with fees (as the bill said), else stays here.
  const nextBill = desk.slice(desk.indexOf(bill.month) + 1).find((m) => m.items.length > 0)?.key ?? null;
  const saved = await saveReceipts(
    { access, account, date, mode, reference, remarks },
    pay.parts.map(({ month, lines, full, total, lateWaived }, i) => {
      const isOwn = month === bill.month.key;
      const left = full - total;
      // Later months' late fees fixed by this payment ride on the last receipt; they are owed on their own bills.
      const owed = i === pay.parts.length - 1 ? pay.owed : [];
      return {
        lines: [...lines, ...owed].map(receiptLine),
        discountNote: isOwn && discount > 0 ? discountNote : null,
        lateWaived,
        // Previous dues: an add-on receipt for the month that owed them, collected at this bill; what is left stays on it.
        bill: isOwn
          ? { month, leftOwing: left, leftTo: left > 0 ? nextBill : null }
          : { month, leftOwing: left, leftTo: left > 0 ? bill.month.key : null, collectedOn: bill.month.key },
      };
    }),
  );
  if ("error" in saved) return { error: saved.error };
  revalidatePath("/admin/fees", "layout");
  revalidatePath("/admin/fee-desk");
  // Straight to the receipt, which confirms the payment and is ready to print; it links the add-on receipts made with it.
  const main = saved.at(-1)!;
  const addOns = saved.slice(0, -1).map((r) => r.id);
  redirect(`/admin/fees/receipts/${main.id}?new=1&from=desk${addOns.length ? `&with=${addOns.join(",")}` : ""}`);
}

const waiveSchema = z.object({
  month: z.string().min(1),
  reason: z.string().trim().min(3, "Say why the dues are waived").max(200),
});

/**
 * Writes off the previous dues carried into a month's bill (what part-paid
 * earlier months left: fees and late fees), without collecting money. Admins
 * only. Each earlier month gets its own numbered waiver ("…/W0001"), tied back
 * to that month like an add-on receipt, with the reason and who did it; it
 * shows in the ledger and can be cancelled like a receipt to undo it. The
 * month's own fees can then be collected as usual.
 */
export async function waiveDues(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getFeesAccess();
  if (!access.canManage) return { error: "Only an admin can waive dues." };
  const { school, session, today } = access;
  const account = await loadStudentAccount(school.id, studentId);
  if (!account || account.student.status !== "ACTIVE") return { error: "Student not found." };
  const parsed = waiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { month, reason } = parsed.data;
  const bill = billOf(deskMonths(account.dues, session.startDate.toISOString().slice(0, 10), today), month);
  if (!bill) return { error: "Month not found." };
  // Each earlier month's fees come off as a discount, and its late fees (fixed earlier or run up since) are waived.
  const off = allocateBill(account.dues, bill.carried.map((m) => m.key), { writeOff: true, payDate: today });
  const months = off.months.filter((m) => m.waived > 0);
  if (!months.length) return { error: "There are no previous dues on this bill. Reload the page." };
  const saved = await saveReceipts(
    { access, account, date: today, mode: "OTHER", reference: null, remarks: null },
    months.map((m, i) => ({
      // A later month's late fee fixed on the way stays owed on that month's bill.
      lines: [...m.lines, ...(i === months.length - 1 ? off.owed : [])].map(receiptLine),
      discountNote: reason,
      lateWaived: m.lateWaived,
      waiver: true,
      bill: { month: m.month, leftOwing: 0, leftTo: null, collectedOn: month },
    })),
  );
  if ("error" in saved) return { error: saved.error };
  const total = months.reduce((n, m) => n + m.waived, 0);
  revalidatePath("/admin/fees", "layout");
  revalidatePath("/admin/fee-desk", "layout");
  return { ok: true, message: `${rupees(total)} of previous dues waived (${saved.map((r) => r.number).join(", ")}).` };
}
