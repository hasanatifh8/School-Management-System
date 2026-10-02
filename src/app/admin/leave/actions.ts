"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { createLeaveRecord, decideLeaveRecord, withdrawLeaveRecord, type LeaveActor } from "@/lib/leave";
import { getCurrentSchool, getViewer } from "@/lib/school";

async function adminActor(): Promise<LeaveActor> {
  const school = await getCurrentSchool(); // admins / Power Admin only
  const viewer = await getViewer();
  return { kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" };
}

export async function createLeave(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await createLeaveRecord(await adminActor(), formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function decideLeave(id: string, approve: boolean, _: ActionState, formData: FormData): Promise<ActionState> {
  const result = await decideLeaveRecord(await adminActor(), id, approve, formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteLeave(id: string): Promise<ActionState> {
  const result = await withdrawLeaveRecord(await adminActor(), id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
