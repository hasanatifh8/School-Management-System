"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { getFeesAccess } from "@/lib/fees";
import { getCurrentSchool } from "@/lib/school";
import { sessionMonths } from "@/lib/fees-shared";
import { getCurrentSession } from "@/lib/sessions";
import { assignStudentTransport, readFeeRange } from "@/lib/transport-fees";

/** Admission step 2: put the new student on the chosen bus and stop, then go to fees. */
export async function admissionTransport(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const routeId = String(formData.get("routeId") ?? "");
  if (!routeId) return { error: "Choose a bus, or skip this step." };
  // A new student pays the transport fee for the months chosen (from admission by default).
  const session = await getCurrentSession(school.id);
  const range = readFeeRange(formData, sessionMonths(session.startDate.toISOString().slice(0, 10)));
  const result = await assignStudentTransport(school.id, studentId, routeId, String(formData.get("stop") ?? ""), range);
  if (result.error) return result;
  revalidatePath("/admin", "layout");
  redirect(`/admin/students/new/${studentId}/fees`);
}

/**
 * Admission step 3: charge the ticked opt-in fees and stop charging the unticked
 * ones (unless already paid towards). Opt-ins start with the admission.
 */
export async function admissionFees(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await getCurrentSchool();
  const { school, session } = await getFeesAccess();
  const student = await db.student.findFirst({ where: { id: studentId, schoolId: school.id }, select: { id: true, section: { select: { classId: true } } } });
  if (!student) return { error: "Student not found." };
  const classId = student.section?.classId;

  const offered = classId
    ? await db.feeHead.findMany({ where: { sessionId: session.id, optional: true, amounts: { some: { classId, amount: { gt: 0 } } } }, select: { id: true } })
    : [];
  const ticked = new Set(formData.getAll("headIds").map(String));
  const add = offered.filter((h) => ticked.has(h.id)).map((h) => h.id);
  const drop = offered.filter((h) => !ticked.has(h.id)).map((h) => h.id);
  const paid = new Set(
    (await db.feeReceiptItem.findMany({ where: { headId: { in: drop }, receipt: { studentId, cancelledAt: null } }, select: { headId: true } })).map((p) => p.headId),
  );

  await db.$transaction([
    db.studentFeeHead.createMany({ data: add.map((headId) => ({ studentId, headId, fromDate: null })), skipDuplicates: true }),
    db.studentFeeHead.deleteMany({ where: { studentId, headId: { in: drop.filter((id) => !paid.has(id)) } } }),
  ]);
  revalidatePath("/admin", "layout");
  // Last step: the admission acknowledgement, ready to print.
  redirect(`/admin/students/${studentId}/acknowledgement?new=1`);
}
