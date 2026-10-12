"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { audit } from "@/lib/power-tools";
import { getCurrentSchool, getViewer } from "@/lib/school";

/** Sunday is always off; this sets whether Saturday is a weekly off too. */
export async function saveWeeklyOff(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const saturdayOff = formData.get("saturdayOff") === "on";
  await db.school.update({ where: { id: school.id }, data: { saturdayOff } });
  const viewer = await getViewer();
  await audit(`Weekly off set to ${saturdayOff ? "Saturday and Sunday" : "Sunday"}`, { id: school.id, name: school.name }, viewer?.kind === "admin" ? `By ${viewer.admin.email}` : undefined);
  revalidatePath("/", "layout");
  return { ok: true, message: saturdayOff ? "Saturday and Sunday are now weekly offs." : "Sunday is now the only weekly off." };
}
