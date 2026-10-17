"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { createMaterialRecord, deleteMaterialRecord, type MaterialActor } from "@/lib/materials";
import { fullName } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

async function teacherActor(): Promise<MaterialActor> {
  const ctx = await requireTeacher();
  return { kind: "teacher", schoolId: ctx.school.id, who: `${fullName(ctx.teacher)} (teacher)`, ctx };
}

export async function postMaterial(_: ActionState, formData: FormData): Promise<ActionState> {
  const state = await createMaterialRecord(await teacherActor(), formData);
  if (state.ok) revalidatePath("/teacher/materials");
  return state;
}

export async function removeMaterial(id: string): Promise<ActionState> {
  const state = await deleteMaterialRecord(await teacherActor(), id);
  if (state.ok) revalidatePath("/teacher/materials");
  return state;
}
