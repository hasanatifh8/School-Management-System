"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { createMaterialRecord, deleteMaterialRecord, type MaterialActor } from "@/lib/materials";
import { getCurrentSchool, getViewer } from "@/lib/school";

async function adminActor(): Promise<MaterialActor> {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  return { kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? `${viewer.admin.name} (admin)` : "Power Admin" };
}

export async function createMaterial(_: ActionState, formData: FormData): Promise<ActionState> {
  const state = await createMaterialRecord(await adminActor(), formData);
  if (state.ok) revalidatePath("/", "layout");
  return state;
}

export async function deleteMaterial(id: string): Promise<ActionState> {
  const state = await deleteMaterialRecord(await adminActor(), id);
  if (state.ok) revalidatePath("/", "layout");
  return state;
}
