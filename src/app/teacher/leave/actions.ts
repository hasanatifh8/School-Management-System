"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { createLeaveRecord, decideLeaveRecord, teacherLeaveActor, withdrawLeaveRecord } from "@/lib/leave";
import { requireTeacher } from "@/lib/teacher-auth";

export async function applyLeave(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await createLeaveRecord(teacherLeaveActor(await requireTeacher()), formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function decideStudentLeave(id: string, approve: boolean, _: ActionState, formData: FormData): Promise<ActionState> {
  const result = await decideLeaveRecord(teacherLeaveActor(await requireTeacher()), id, approve, formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function withdrawLeave(id: string): Promise<ActionState> {
  const result = await withdrawLeaveRecord(teacherLeaveActor(await requireTeacher()), id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
