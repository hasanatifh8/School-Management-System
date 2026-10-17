"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { createStudentLeaveRecord, withdrawStudentLeaveRecord } from "@/lib/leave";
import { requireStudent } from "@/lib/student-auth";

export async function applyStudentLeave(_: ActionState, formData: FormData): Promise<ActionState> {
  const { student } = await requireStudent();
  const state = await createStudentLeaveRecord(student, formData);
  if (state.ok) revalidatePath("/student", "layout");
  return state;
}

export async function withdrawStudentLeave(id: string): Promise<ActionState> {
  const { student } = await requireStudent();
  const state = await withdrawStudentLeaveRecord(student.id, id);
  if (state.ok) revalidatePath("/student", "layout");
  return state;
}
