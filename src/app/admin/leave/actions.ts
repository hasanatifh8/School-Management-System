"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import {
  bulkApproveRecords,
  createLeaveRecord,
  decideLeaveRecord,
  deleteLeavePolicyRecord,
  saveAllowanceRecords,
  saveLeavePolicyRecord,
  saveLeaveRulesRecord,
  savePersonLeaveRecord,
  withdrawLeaveRecord,
  type LeaveActor,
} from "@/lib/leave";
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

export async function bulkApproveLeave(ids: string[]): Promise<ActionState> {
  const result = await bulkApproveRecords(await adminActor(), ids);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveAllowances(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const result = await saveAllowanceRecords(school.id, formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveLeaveRules(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const result = await saveLeaveRulesRecord(school.id, formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveLeavePolicy(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const result = await saveLeavePolicyRecord(school.id, id, formData);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/settings/leave/groups/${result.id}`);
  return result;
}

export async function deleteLeavePolicy(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const result = await deleteLeavePolicyRecord(school.id, id);
  revalidatePath("/", "layout");
  redirect("/admin/settings/leave");
  return result;
}

export async function savePersonLeave(person: { teacherId: string } | { staffId: string }, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const result = await savePersonLeaveRecord(school.id, person, formData);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
