"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { type ActionState, validationError } from "@/lib/action-state";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { receiptLine, saveReceipt } from "@/lib/fee-receipts";
import { getFeesAccess, loadStudentAccount, outstandingByStudent } from "@/lib/fees";
import { PAYMENT_MODES, payMonths } from "@/lib/fees-shared";
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
});

/**
 * The Fee desk's collection: one month's bill is paid in full, with its late
 * fee (see payMonths), then a receipt is made and opened.
 */
export async function quickCollect(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getFeesAccess();
  const { school, session, today } = access;
  const account = await loadStudentAccount(school.id, studentId);
  if (!account || account.student.status !== "ACTIVE") return { error: "Student not found." };
  const parsed = quickSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { discount, discountNote, date, mode, reference, remarks } = parsed.data;
  const months = formData.getAll("month").map(String);

  if (date > today || date < session.startDate.toISOString().slice(0, 10)) {
    return { error: `The payment date must be in session ${session.name}, not in the future.`, fieldErrors: { date: ["Out of range"] } };
  }
  // Each month is billed and collected on its own.
  if (months.length !== 1) return { error: "Collect one month at a time." };
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
  const plan = payMonths(account.dues, months, { discount, waiveLate: formData.get("waiveLate") === "on", lateChoice, payDate: date });
  if (plan.unusedDiscount > 0) return { error: "The discount is more than the fees of the ticked months.", fieldErrors: { discount: ["Too large"] } };
  if (!plan.lines.length) return { error: "This month is already paid. Reload the page." };

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
  // Straight to the receipt, which confirms the payment and is ready to print.
  redirect(`/admin/fees/receipts/${saved.id}?new=1&from=desk`);
}
