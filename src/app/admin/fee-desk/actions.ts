"use server";

import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { type ActionState, validationError } from "@/lib/action-state";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { receiptLine, saveReceipt } from "@/lib/fee-receipts";
import { getFeesAccess, loadStudentAccount, outstandingByStudent } from "@/lib/fees";
import { PAYMENT_MODES, allocatePayment, rupees } from "@/lib/fees-shared";
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
  amount: z
    .string()
    .transform((v) => v.replace(/[,\s₹]/g, ""))
    .refine((v) => /^\d{0,8}$/.test(v), "Enter the amount in whole rupees")
    .transform((v) => (v ? Number(v) : 0)),
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
});

/**
 * The Fee desk's one-step collection: the amount received is applied to the
 * student's dues oldest first (see allocatePayment), then a receipt is made and
 * the desk shows it, ready for the next student.
 */
export async function quickCollect(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getFeesAccess();
  const { school, session, today } = access;
  const account = await loadStudentAccount(school.id, studentId);
  if (!account || account.student.status !== "ACTIVE") return { error: "Student not found." };
  const parsed = quickSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { amount, discount, discountNote, date, mode, reference, remarks } = parsed.data;

  if (date > today || date < session.startDate.toISOString().slice(0, 10)) {
    return { error: `The payment date must be in session ${session.name}, not in the future.`, fieldErrors: { date: ["Out of range"] } };
  }
  if (amount <= 0 && discount <= 0) return { error: "Enter the amount received.", fieldErrors: { amount: ["Enter the amount"] } };
  if ((mode === "CHEQUE" || mode === "UPI" || mode === "BANK_TRANSFER") && !reference) {
    return { error: "Enter the cheque / UPI / transaction number.", fieldErrors: { reference: ["Required for this payment mode"] } };
  }
  if (discount > 0 && (!discountNote || discountNote.length < 3)) {
    return { error: "Say why the discount is given, e.g. sibling or staff ward.", fieldErrors: { discountNote: ["Reason needed for a discount"] } };
  }

  const plan = allocatePayment(account.dues, { amount, discount, waiveLate: formData.get("waiveLate") === "on", payDate: date });
  if (plan.excess > 0) {
    return { error: `${rupees(plan.excess)} more than everything this student owes for the session. Collect ${rupees(amount - plan.excess)} instead.`, fieldErrors: { amount: ["More than owed"] } };
  }
  if (plan.unusedDiscount > 0) {
    return { error: `The discount is ${rupees(plan.unusedDiscount)} more than the fees this payment covers. Lower it, or collect more.`, fieldErrors: { discount: ["Too large"] } };
  }
  if (!plan.lines.length) return { error: "Nothing to collect: this student has no dues." };

  const saved = await saveReceipt({
    access,
    account,
    lines: plan.lines.map((l) => receiptLine(l.item, l.amount, l.discount, l.lateFee)),
    date,
    mode,
    reference,
    remarks,
    discountNote: discount > 0 ? discountNote : null,
    lateWaived: plan.lateWaived,
  });
  if ("error" in saved) return { error: saved.error };
  revalidatePath("/admin/fees", "layout");
  revalidatePath("/admin/fee-desk");
  redirect(`/admin/fee-desk?s=${studentId}&r=${saved.id}`, RedirectType.replace);
}
