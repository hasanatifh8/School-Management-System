"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { fullName } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { saveSectionTimetable } from "@/lib/timetable";

/** The class teacher saves their own section's timetable, unless an admin locked it. */
export async function saveClassTimetable(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeacher();
  if (!ctx.classSection) return { error: "Only a class teacher can edit a class timetable." };
  const timetable = await db.timetable.findUnique({ where: { sectionId: ctx.classSection.id } });
  if (timetable?.locked) return { error: "The admin has locked this timetable, so it can't be changed." };
  const result = await saveSectionTimetable(ctx.school.id, ctx.classSection.id, formData, `${fullName(ctx.teacher)} (class teacher)`);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
