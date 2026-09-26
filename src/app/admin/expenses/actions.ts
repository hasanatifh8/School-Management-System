"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, optionalMobile, optionalPastDate, requiredName, validationError } from "@/lib/action-state";
import { addMonths, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { ensureCategories, isMonth, loadPayroll, requireExpensesAccess } from "@/lib/expenses";
import { PAYMENT_MODES } from "@/lib/fees-shared";

const rupeesField = (label: string) =>
  z
    .string()
    .transform((v) => v.replace(/[,\s₹]/g, ""))
    .refine((v) => /^\d{1,9}$/.test(v) && Number(v) > 0, `${label} must be a whole number of rupees`)
    .transform(Number);

const optionalRupees = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const t = (v ?? "").replace(/[,\s₹]/g, "");
    if (!t) return null;
    if (!/^\d{1,9}$/.test(t)) {
      ctx.addIssue({ code: "custom", message: "Whole rupees only" });
      return z.NEVER;
    }
    return Number(t);
  });

const dateField = (label: string, today: string) =>
  z.string().refine((v) => parseISODate(v) && v <= today, `${label} must be a real date, not in the future`);

const revalidate = () => revalidatePath("/admin", "layout");

/* ───────────────────────── Non-teaching staff ───────────────────────── */

const staffSchema = z.object({
  name: requiredName("Name").refine((v) => v.length >= 2, "Enter the full name"),
  designation: z.string().trim().min(2, "Enter the job, e.g. Security guard").max(60),
  phone: optionalMobile,
  monthlySalary: optionalRupees,
  joiningDate: optionalPastDate,
});

export async function saveStaffMember(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (id) {
    const { count } = await db.staffMember.updateMany({ where: { id, schoolId: school.id }, data: parsed.data });
    if (!count) return { error: "Staff member not found." };
  } else {
    await db.staffMember.create({ data: { ...parsed.data, schoolId: school.id } });
  }
  revalidate();
  return { ok: true, message: id ? "Saved." : `${parsed.data.name} added.` };
}

export async function setStaffMemberStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const { count } = await db.staffMember.updateMany({ where: { id, schoolId: school.id }, data: { status } });
  if (!count) return { error: "Staff member not found." };
  revalidate();
  return { ok: true, message: status === "ACTIVE" ? "Back on the payroll." : "Removed from the payroll. Past salary records are kept." };
}

/* ───────────────────────── Payroll ───────────────────────── */

function checkMonth(month: string, current: string) {
  return isMonth(month) && month <= addMonths(current, 1);
}

export async function paySalary(key: string, month: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, today, month: current, who } = await requireExpensesAccess();
  if (!checkMonth(month, current)) return { error: "Choose a month up to next month." };
  const parsed = z
    .object({
      amount: rupeesField("Amount"),
      paidOn: dateField("Paid on", today),
      mode: z.enum(PAYMENT_MODES),
      note: z.string().trim().max(200).optional().transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const row = (await loadPayroll(school.id, month)).find((r) => r.key === key);
  if (!row || (row.type === "TEACHER" ? !key.startsWith("T:") : !key.startsWith("S:"))) return { error: "Person not found." };
  if (row.payment) return { error: `${row.name} is already paid for this month.` };
  await db.salaryPayment.create({
    data: {
      schoolId: school.id,
      month,
      payeeType: row.type,
      ...(row.type === "TEACHER" ? { teacherId: row.id } : { staffId: row.id }),
      name: row.name,
      role: row.role,
      amount: parsed.data.amount,
      paidOn: parseISODate(parsed.data.paidOn)!,
      mode: parsed.data.mode,
      note: parsed.data.note,
      createdBy: who,
    },
  });
  revalidate();
  return { ok: true, message: `Paid ${row.name}.` };
}

/** Pays everyone not yet paid this month their monthly salary, on one date. */
export async function payAllSalaries(month: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, today, month: current, who } = await requireExpensesAccess();
  if (!checkMonth(month, current)) return { error: "Choose a month up to next month." };
  const parsed = z.object({ paidOn: dateField("Paid on", today), mode: z.enum(PAYMENT_MODES) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const due = (await loadPayroll(school.id, month)).filter((r) => !r.payment && r.salary);
  if (!due.length) return { error: "Everyone with a salary is already paid for this month." };
  await db.salaryPayment.createMany({
    data: due.map((r) => ({
      schoolId: school.id,
      month,
      payeeType: r.type,
      teacherId: r.type === "TEACHER" ? r.id : null,
      staffId: r.type === "STAFF" ? r.id : null,
      name: r.name,
      role: r.role,
      amount: r.salary!,
      paidOn: parseISODate(parsed.data.paidOn)!,
      mode: parsed.data.mode,
      createdBy: who,
    })),
    skipDuplicates: true,
  });
  revalidate();
  return { ok: true, message: `Paid ${due.length} salar${due.length === 1 ? "y" : "ies"}.` };
}

export async function undoSalary(paymentId: string): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const { count } = await db.salaryPayment.deleteMany({ where: { id: paymentId, schoolId: school.id } });
  if (!count) return { error: "Payment not found." };
  revalidate();
  return { ok: true, message: "Payment removed." };
}

/* ───────────────────────── Expenses ───────────────────────── */

export async function addExpense(_: ActionState, formData: FormData): Promise<ActionState> {
  const { school, today, who } = await requireExpensesAccess();
  const parsed = z
    .object({
      categoryId: z.string().min(1, "Choose a category"),
      date: dateField("Date", today),
      amount: rupeesField("Amount"),
      paidTo: z.string().trim().max(100).optional().transform((v) => v || null),
      description: z.string().trim().max(300).optional().transform((v) => v || null),
      mode: z.enum(PAYMENT_MODES),
      reference: z.string().trim().max(60).optional().transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const category = await db.expenseCategory.findFirst({ where: { id: parsed.data.categoryId, schoolId: school.id } });
  if (!category) return { error: "Choose a category", fieldErrors: { categoryId: ["Choose a category"] } };
  if (category.isSalaries) return { error: "Record salaries on the Salaries page.", fieldErrors: { categoryId: ["Use the Salaries page"] } };
  await db.expense.create({ data: { ...parsed.data, date: parseISODate(parsed.data.date)!, schoolId: school.id, createdBy: who } });
  revalidate();
  return { ok: true, message: `Added ${category.name} expense.` };
}

export async function deleteExpense(id: string): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const { count } = await db.expense.deleteMany({ where: { id, schoolId: school.id } });
  if (!count) return { error: "Expense not found." };
  revalidate();
  return { ok: true, message: "Expense deleted." };
}

/* ───────────────────────── Categories & budgets ───────────────────────── */

/** Saves every category's monthly budget from fields named `budget:<id>` (blank = no budget). */
export async function saveBudgets(_: ActionState, formData: FormData): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const categories = await ensureCategories(school.id);
  const updates: { id: string; monthlyBudget: number | null }[] = [];
  for (const c of categories) {
    const raw = String(formData.get(`budget:${c.id}`) ?? "").replace(/[,\s₹]/g, "");
    if (raw && !/^\d{1,9}$/.test(raw)) return { error: `${c.name}: whole rupees only.`, fieldErrors: { [`budget:${c.id}`]: ["Whole rupees only"] } };
    updates.push({ id: c.id, monthlyBudget: raw ? Number(raw) : null });
  }
  await db.$transaction(updates.map((u) => db.expenseCategory.update({ where: { id: u.id }, data: { monthlyBudget: u.monthlyBudget } })));
  revalidate();
  return { ok: true, message: "Budgets saved. They apply to every month." };
}

export async function addCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const parsed = z.object({ name: z.string().trim().min(2, "Enter a name").max(60), monthlyBudget: optionalRupees }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  await ensureCategories(school.id);
  const clash = await db.expenseCategory.findFirst({ where: { schoolId: school.id, name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (clash) return { error: `“${clash.name}” already exists.`, fieldErrors: { name: ["Already exists"] } };
  const last = await db.expenseCategory.aggregate({ where: { schoolId: school.id }, _max: { sortOrder: true } });
  await db.expenseCategory.create({ data: { schoolId: school.id, ...parsed.data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  revalidate();
  return { ok: true, message: `Added “${parsed.data.name}”.` };
}

export async function deleteCategory(id: string): Promise<ActionState> {
  const { school } = await requireExpensesAccess();
  const category = await db.expenseCategory.findFirst({ where: { id, schoolId: school.id }, include: { _count: { select: { expenses: true } } } });
  if (!category) return { error: "Category not found." };
  if (category.isSalaries) return { error: "Salaries is built in and can't be removed." };
  if (category._count.expenses) return { error: `“${category.name}” has ${category._count.expenses} expense(s), so it can't be removed.` };
  await db.expenseCategory.delete({ where: { id } });
  revalidate();
  return { ok: true, message: `Removed “${category.name}”.` };
}
