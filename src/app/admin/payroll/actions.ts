"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { addMonths, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { isMonth, requireExpensesAccess } from "@/lib/expenses";
import { PAYMENT_MODES } from "@/lib/fees-shared";
import type { SlipLine } from "@/lib/payroll-shared";
import { logged } from "@/lib/activity";

const revalidate = () => revalidatePath("/", "layout");

/** Publishes one slip: the teacher can see it from now on. */
export async function publishPayslip(id: string): Promise<ActionState> {
  const { school, who } = await requireExpensesAccess();
  const p = await db.salaryPayment.findFirst({ where: { id, schoolId: school.id }, select: { name: true, month: true, published: true } });
  if (!p) return { error: "This salary slip no longer exists." };
  if (p.published) return { ok: true, message: "Already published." };
  await db.salaryPayment.update({ where: { id }, data: { published: true, publishedAt: new Date(), publishedBy: who } });
  revalidate();
  return logged("Payroll", { ok: true, message: `${p.name}'s slip is published.` }, `Published ${p.name}'s salary slip for ${p.month}`);
}

/** Takes a slip back to draft: hidden from the teacher, and editable again. */
export async function unpublishPayslip(id: string): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const p = await db.salaryPayment.findFirst({ where: { id, schoolId: school.id }, select: { name: true, month: true } });
  if (!p) return { error: "This salary slip no longer exists." };
  await db.salaryPayment.update({ where: { id }, data: { published: false, publishedAt: null, publishedBy: null } });
  revalidate();
  return logged(
    "Payroll",
    { ok: true, message: `${p.name}'s slip is back to draft and hidden from them.` },
    `Unpublished ${p.name}'s salary slip for ${p.month}`,
  );
}

/** Publishes every draft slip of a month. */
export async function publishAllPayslips(month: string): Promise<ActionState> {
  const { school, who } = await requireExpensesAccess();
  if (!isMonth(month)) return { error: "Choose a month." };
  const { count } = await db.salaryPayment.updateMany({
    where: { schoolId: school.id, month, published: false },
    data: { published: true, publishedAt: new Date(), publishedBy: who },
  });
  revalidate();
  if (!count) return { ok: true, message: "Every slip this month is already published." };
  return logged("Payroll", { ok: true, message: `Published ${count} salary slip${count === 1 ? "" : "s"}.` }, `Published ${count} salary slips for ${month}`);
}

const lineSchema = z.object({
  name: z.string().trim().min(1, "Name every line").max(60, "Keep line names under 60 letters"),
  kind: z.enum(["EARNING", "DEDUCTION"]),
  amount: z.number().int("Whole rupees only").min(0, "Amounts can't be negative").max(99_99_999, "That amount is too large"),
  note: z.string().trim().max(160, "Keep the reason under 160 letters").optional(),
});

/**
 * Saves an edited draft slip: its lines (sent as JSON), unpaid days, paid on,
 * mode and note. The amount paid becomes earnings minus deductions.
 */
export async function updatePayslip(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, today } = await requireExpensesAccess();
  const p = await db.salaryPayment.findFirst({ where: { id, schoolId: school.id }, select: { published: true, name: true, month: true } });
  if (!p) return { error: "This salary slip no longer exists." };
  if (p.published) return { error: "Published slips can't be changed. Unpublish it first." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "The slip could not be read. Reload the page and try again." };
  }
  const lines = z.array(lineSchema).min(1, "Add at least one earning").max(30, "At most 30 lines").safeParse(raw);
  if (!lines.success) return { error: lines.error.issues[0]?.message ?? "Check the lines." };
  const header = z
    .object({
      paidOn: z.string().refine((v) => parseISODate(v) && v <= today, "Paid on must be a real date, not in the future"),
      mode: z.enum(PAYMENT_MODES),
      lopDays: z
        .string()
        .optional()
        .transform((v) => (v?.trim() ? Number(v) : 0))
        .refine((v) => Number.isFinite(v) && v >= 0 && v <= 31 && Math.round(v * 2) === v * 2, "Unpaid days: 0 to 31, in half days"),
      note: z
        .string()
        .trim()
        .max(200)
        .optional()
        .transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!header.success) return validationError(header.error);

  const clean: SlipLine[] = lines.data.map((l) => ({ name: l.name, kind: l.kind, amount: l.amount, ...(l.note && { note: l.note }) }));
  const gross = clean.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amount, 0);
  const deductions = clean.filter((l) => l.kind === "DEDUCTION").reduce((n, l) => n + l.amount, 0);
  if (gross <= 0) return { error: "Add at least one earning." };
  if (deductions > gross) return { error: "Deductions can't be more than the earnings." };
  const lop = clean.filter((l) => l.kind === "DEDUCTION" && /^loss of pay/i.test(l.name)).reduce((n, l) => n + l.amount, 0);

  await db.salaryPayment.update({
    where: { id },
    data: {
      lines: clean,
      gross,
      amount: gross - deductions,
      lopDays: header.data.lopDays || null,
      lopAmount: lop || null,
      paidOn: parseISODate(header.data.paidOn)!,
      mode: header.data.mode,
      note: header.data.note,
    },
  });
  revalidate();
  return logged(
    "Payroll",
    { ok: true, message: `${p.name}'s slip saved. Net pay ₹${(gross - deductions).toLocaleString("en-IN")}.` },
    `Edited ${p.name}'s salary slip for ${p.month}`,
  );
}

const oneTimeSchema = z.object({
  target: z.string().min(1, "Choose who it's for"),
  name: z.string().trim().min(1, "Give it a name, e.g. Diwali bonus").max(60, "Keep the name under 60 letters"),
  kind: z.enum(["EARNING", "DEDUCTION"], "Choose earning or deduction"),
  amount: z
    .string()
    .transform((v) => v.replace(/[,\s₹]/g, ""))
    .refine((v) => /^\d{1,8}$/.test(v) && Number(v) > 0, "Enter a whole number of rupees")
    .transform(Number),
  note: z
    .string()
    .trim()
    .max(160, "Keep the reason under 160 letters")
    .optional()
    .transform((v) => v || null),
});

/**
 * Adds a one-time earning or deduction to a month's salary for one person
 * ("T:<id>" / "S:<id>") or a group ("TEACHERS", "STAFF", "EVERYONE"). People
 * already paid for the month are skipped: change their draft slip instead.
 */
export async function addOneTimeItem(month: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, who, month: current } = await requireExpensesAccess();
  if (!isMonth(month) || month < addMonths(current, -1) || month > addMonths(current, 1))
    return { error: "One-time items can be added for last month, this month or next month." };
  const parsed = oneTimeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const [teachers, staff, paid] = await Promise.all([
    db.teacher.findMany({ where: { schoolId: school.id, status: "ACTIVE" }, select: { id: true } }),
    db.staffMember.findMany({ where: { schoolId: school.id, status: "ACTIVE" }, select: { id: true } }),
    db.salaryPayment.findMany({ where: { schoolId: school.id, month }, select: { teacherId: true, staffId: true } }),
  ]);
  const all = [...teachers.map((t) => `T:${t.id}`), ...staff.map((s) => `S:${s.id}`)];
  const chosen =
    v.target === "TEACHERS"
      ? all.filter((k) => k.startsWith("T:"))
      : v.target === "STAFF"
        ? all.filter((k) => k.startsWith("S:"))
        : v.target === "EVERYONE"
          ? all
          : all.filter((k) => k === v.target);
  if (!chosen.length) return { error: "Choose someone from the list.", fieldErrors: { target: ["Choose someone from the list"] } };
  const paidKeys = new Set(paid.map((p) => (p.teacherId ? `T:${p.teacherId}` : `S:${p.staffId}`)));
  const due = chosen.filter((k) => !paidKeys.has(k));
  if (!due.length) {
    const message =
      chosen.length === 1
        ? "Already paid for this month. Add it by editing their draft slip in Payroll."
        : "Everyone chosen is already paid for this month. Edit their draft slips instead.";
    return { error: message, fieldErrors: { target: [message] } };
  }
  await db.salaryAdjustment.createMany({
    data: due.map((k) => ({
      schoolId: school.id,
      month,
      ...(k.startsWith("T:") ? { teacherId: k.slice(2) } : { staffId: k.slice(2) }),
      name: v.name,
      kind: v.kind,
      amount: v.amount,
      note: v.note,
      createdBy: who,
    })),
  });
  revalidate();
  const skipped = chosen.length - due.length;
  return logged(
    "Payroll",
    {
      ok: true,
      message: `${v.name} added for ${due.length} ${due.length === 1 ? "person" : "people"}.${skipped ? ` ${skipped} already paid ${skipped === 1 ? "was" : "were"} skipped.` : ""}`,
    },
    `Added one-time ${v.kind === "EARNING" ? "earning" : "deduction"} ${v.name} (₹${v.amount.toLocaleString("en-IN")}) for ${due.length} people, ${month}`,
  );
}

/** Removes a one-time item that hasn't been paid yet. */
export async function removeOneTimeItem(id: string): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const item = await db.salaryAdjustment.findFirst({ where: { id, schoolId: school.id } });
  if (!item) return { ok: true, message: "Removed." };
  const paid = await db.salaryPayment.findFirst({
    where: { schoolId: school.id, month: item.month, ...(item.teacherId ? { teacherId: item.teacherId } : { staffId: item.staffId }) },
    select: { id: true },
  });
  if (paid) return { error: "This salary is already paid with the item on its slip. Edit the draft slip instead." };
  await db.salaryAdjustment.delete({ where: { id } });
  revalidate();
  return logged("Payroll", { ok: true, message: `${item.name} removed.` });
}
