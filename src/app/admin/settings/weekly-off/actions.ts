"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { logged } from "@/lib/activity";

/** Sunday is always off; this sets whether Saturday is a weekly off too. */
export async function saveWeeklyOff(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const saturdayOff = formData.get("saturdayOff") === "on";
  await db.school.update({ where: { id: school.id }, data: { saturdayOff } });
  revalidatePath("/", "layout");
  return logged("Settings", { ok: true, message: saturdayOff ? "Saturday and Sunday are now weekly offs." : "Sunday is now the only weekly off." }, `Weekly off set to ${saturdayOff ? "Saturday and Sunday" : "Sunday"}`);
}
