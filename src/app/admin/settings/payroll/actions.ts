"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { db } from "@/lib/db";
import { BASIC_PAY, isReservedName, lopRuleText, type LopRule } from "@/lib/payroll-shared";
import { getCurrentSchool } from "@/lib/school";
import { logged } from "@/lib/activity";

const MAX_RUPEES = 10_000_000;

const componentSchema = z
  .object({
    name: z.string().trim().min(2, "Give it a name, e.g. HRA").max(40, "Keep it under 40 characters"),
    kind: z.enum(["EARNING", "DEDUCTION"], "Choose earning or deduction"),
    calc: z.enum(["FIXED", "PERCENT_OF_BASIC"], "Choose how it's worked out"),
    defaultValue: z
      .string()
      .optional()
      .transform((v) => (v ?? "").replace(/[,\s₹%]/g, "")),
  })
  .transform((v, ctx) => {
    if (v.name.toLowerCase() === BASIC_PAY.toLowerCase()) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Basic pay is set on each person's salary" });
      return z.NEVER;
    }
    if (isReservedName(v.name)) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Loss of pay is worked out from attendance (Deduction for absent days below)" });
      return z.NEVER;
    }
    if (!v.defaultValue) return { ...v, defaultValue: null };
    const n = Number(v.defaultValue);
    const ok = v.calc === "FIXED" ? Number.isInteger(n) && n >= 0 && n <= MAX_RUPEES : Number.isFinite(n) && n >= 0 && n <= 100;
    if (!ok) {
      ctx.addIssue({ code: "custom", path: ["defaultValue"], message: v.calc === "FIXED" ? "Whole rupees" : "A percent from 0 to 100" });
      return z.NEVER;
    }
    return { ...v, defaultValue: n };
  });

const refresh = () => revalidatePath("/admin", "layout");

export async function saveSalaryComponent(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = componentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;
  const clash = await db.salaryComponent.findFirst({ where: { schoolId: school.id, name: { equals: data.name, mode: "insensitive" }, ...(id && { id: { not: id } }) } });
  if (clash) return { error: `“${clash.name}” already exists.`, fieldErrors: { name: ["Already used"] } };
  if (id) {
    const existing = await db.salaryComponent.findFirst({ where: { id, schoolId: school.id } });
    if (!existing) return { error: "Component not found." };
    // Percent and rupee values don't mix: changing how it's worked out clears people's own values.
    await db.$transaction([
      db.salaryComponent.update({ where: { id }, data }),
      ...(existing.calc !== data.calc ? [db.salaryValue.deleteMany({ where: { componentId: id } })] : []),
    ]);
  } else {
    const last = await db.salaryComponent.aggregate({ where: { schoolId: school.id }, _max: { sortOrder: true } });
    await db.salaryComponent.create({ data: { ...data, schoolId: school.id, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  refresh();
  return logged("Payroll", { ok: true, message: id ? "Component saved. New salaries use it from now on." : `${data.name} added.` }, `${id ? "Updated" : "Added"} salary component ${data.name}`);
}

/** Turns a component off (kept on past slips) or back on. */
export async function setSalaryComponentActive(id: string, active: boolean): Promise<ActionState> {
  const school = await getCurrentSchool();
  const component = await db.salaryComponent.findFirst({ where: { id, schoolId: school.id }, select: { name: true } });
  if (!component) return { error: "Component not found." };
  await db.salaryComponent.update({ where: { id }, data: { active } });
  refresh();
  return logged("Payroll", { ok: true, message: active ? "Turned on." : "Turned off. It's left out of salaries from now on." }, `Turned ${active ? "on" : "off"} salary component ${component.name}`);
}

/** Deletes a component and everyone's own values for it. Slips already paid keep their lines. */
export async function deleteSalaryComponent(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const component = await db.salaryComponent.findFirst({ where: { id, schoolId: school.id }, select: { name: true } });
  if (!component) return { error: "Component not found." };
  await db.salaryComponent.delete({ where: { id } });
  refresh();
  return logged("Payroll", { ok: true, message: "Component deleted. Salaries already paid keep it on their slips." }, `Deleted salary component ${component.name}`);
}

/**
 * Saves one person's salary: basic pay (their monthly salary) and their own
 * values for components. A blank value means the component's default.
 */
export async function saveSalaryStructure(person: { teacherId: string } | { staffId: string }, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const basicText = String(formData.get("basic") ?? "").replace(/[,\s₹]/g, "");
  if (basicText && !(/^\d{1,8}$/.test(basicText) && Number(basicText) <= MAX_RUPEES)) {
    return { error: "Basic pay must be whole rupees.", fieldErrors: { basic: ["Whole rupees"] } };
  }
  const basic = basicText ? Number(basicText) : null;
  const components = await db.salaryComponent.findMany({ where: { schoolId: school.id } });
  const errors: Record<string, string[]> = {};
  const own: { componentId: string; value: number }[] = [];
  for (const c of components) {
    const raw = formData.get(`c:${c.id}`);
    if (raw == null) continue;
    const text = String(raw).replace(/[,\s₹%]/g, "");
    if (!text) continue;
    const n = Number(text);
    const ok = c.calc === "FIXED" ? Number.isInteger(n) && n >= 0 && n <= MAX_RUPEES : Number.isFinite(n) && n >= 0 && n <= 100;
    if (!ok) errors[`c:${c.id}`] = [c.calc === "FIXED" ? "Whole rupees" : "0 to 100"];
    else own.push({ componentId: c.id, value: n });
  }
  if (Object.keys(errors).length) return { error: "Fix the highlighted values.", fieldErrors: errors };

  const key = "teacherId" in person ? { teacherId: person.teacherId } : { staffId: person.staffId };
  const found =
    "teacherId" in person
      ? await db.teacher.findFirst({ where: { id: person.teacherId, schoolId: school.id }, select: { id: true, firstName: true, lastName: true } }).then((t) => t && { id: t.id, name: `${t.firstName} ${t.lastName}` })
      : await db.staffMember.findFirst({ where: { id: person.staffId, schoolId: school.id }, select: { id: true, name: true } });
  if (!found) return { error: "Person not found." };
  await db.$transaction([
    "teacherId" in person
      ? db.teacher.update({ where: { id: person.teacherId }, data: { monthlySalary: basic } })
      : db.staffMember.update({ where: { id: person.staffId }, data: { monthlySalary: basic } }),
    db.salaryValue.deleteMany({ where: { schoolId: school.id, ...key } }),
    db.salaryValue.createMany({ data: own.map((o) => ({ ...o, ...key, schoolId: school.id })) }),
  ]);
  refresh();
  return logged("Payroll", { ok: true, message: "Salary saved. It applies to months not yet paid." }, `Updated ${found.name}'s salary`, basic == null ? "No basic pay" : `Basic pay ₹${basic.toLocaleString("en-IN")}`);
}

/** Saves how absent days come off salaries: a share of a day's pay, or a fixed amount a day. */
export async function saveLopRule(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const text = (k: string) => String(formData.get(k) ?? "").replace(/[,\s₹%]/g, "");
  let rule: LopRule;
  const countUnmarked = formData.get("unmarked") === "ABSENT";
  if (formData.get("method") === "FIXED") {
    const amount = Number(text("amount"));
    if (!text("amount") || !Number.isInteger(amount) || amount < 0 || amount > 1_000_000)
      return { error: "Enter the amount for each absent day.", fieldErrors: { amount: ["Whole rupees"] } };
    rule = { method: "FIXED", amount, countUnmarked };
  } else {
    const divisorChoice = String(formData.get("divisor") ?? "");
    const divisor = divisorChoice === "MONTH" ? null : Number(divisorChoice === "CUSTOM" ? text("customDivisor") : divisorChoice);
    if (divisor !== null && !(Number.isInteger(divisor) && divisor >= 1 && divisor <= 31))
      return { error: "Divide by a whole number of days, 1 to 31.", fieldErrors: { customDivisor: ["1 to 31"] } };
    const percent = Number(text("percent") || "100");
    if (!Number.isFinite(percent) || percent < 0 || percent > 300) return { error: "The percent must be 0 to 300.", fieldErrors: { percent: ["0 to 300"] } };
    rule = { method: "DAY_PAY", base: formData.get("base") === "BASIC" ? "BASIC" : "GROSS", divisor, percent, countUnmarked };
  }
  await db.school.update({ where: { id: school.id }, data: { lopRule: rule } });
  refresh();
  return logged("Payroll", { ok: true, message: "Absence deduction saved. It applies to salaries not yet paid." }, "Changed the absence deduction", `${lopRuleText(rule)}; unmarked days ${countUnmarked ? "count as absent" : "not deducted"}`);
}
