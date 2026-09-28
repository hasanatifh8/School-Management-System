"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { saveSectionTimetable } from "@/lib/timetable";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PERIODS = 16;

async function adminContext() {
  const school = await getCurrentSchool(); // admins / Power Admin only
  const viewer = await getViewer();
  return { school, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" };
}

/** Saves the bell schedule: periods in order, breaks, and the school days. */
export async function savePeriods(_: ActionState, formData: FormData): Promise<ActionState> {
  const { school } = await adminContext();
  const ids = formData.getAll("id").map(String);
  const names = formData.getAll("name").map((v) => String(v).trim());
  const starts = formData.getAll("startTime").map(String);
  const ends = formData.getAll("endTime").map(String);
  const breaks = formData.getAll("isBreak").map((v) => v === "1");
  const days = [...new Set(formData.getAll("day").map(Number))].filter((d) => d >= 1 && d <= 7).sort();

  if (!days.length) return { error: "Choose at least one school day." };
  if (!names.length) return { error: "Add at least one period." };
  if (names.length > MAX_PERIODS) return { error: `A day can have at most ${MAX_PERIODS} periods and breaks.` };
  if (!breaks.includes(false)) return { error: "Add at least one teaching period (not a break)." };
  for (let i = 0; i < names.length; i++) {
    const label = names[i] || `Row ${i + 1}`;
    if (!names[i] || names[i].length > 40) return { error: `${label}: enter a name (up to 40 letters).` };
    if (!TIME.test(starts[i]) || !TIME.test(ends[i])) return { error: `${label}: enter a start and end time.` };
    if (ends[i] <= starts[i]) return { error: `${label}: the end time must be after the start time.` };
    if (i > 0 && starts[i] < ends[i - 1]) return { error: `${label} starts before ${names[i - 1]} ends. Keep the rows in time order.` };
  }

  const existing = await db.period.findMany({ where: { schoolId: school.id }, select: { id: true } });
  const known = new Set(existing.map((p) => p.id));
  const kept = new Set(ids.filter((id) => known.has(id)));

  await db.$transaction(async (tx) => {
    await tx.period.deleteMany({ where: { schoolId: school.id, id: { notIn: [...kept] } } });
    for (let i = 0; i < names.length; i++) {
      const data = { name: names[i], startTime: starts[i], endTime: ends[i], isBreak: breaks[i], sortOrder: i };
      if (kept.has(ids[i])) await tx.period.update({ where: { id: ids[i] }, data });
      else await tx.period.create({ data: { ...data, schoolId: school.id } });
    }
    // Breaks and dropped days hold no lessons.
    await tx.timetableSlot.deleteMany({
      where: { section: { class: { schoolId: school.id } }, OR: [{ day: { notIn: days } }, { period: { isBreak: true } }] },
    });
    await tx.school.update({ where: { id: school.id }, data: { timetableDays: days } });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `Bell schedule saved: ${breaks.filter((b) => !b).length} periods a day, ${days.length} days a week.` };
}

export async function saveTimetable(sectionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { school, who } = await adminContext();
  const result = await saveSectionTimetable(school.id, sectionId, formData, who);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Locked timetables can only be changed by admins. */
export async function setTimetableLock(sectionId: string, locked: boolean): Promise<ActionState> {
  const { school, who } = await adminContext();
  const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId: school.id } } });
  if (!section) return { error: "Class not found." };
  await db.timetable.upsert({ where: { sectionId }, create: { sectionId, locked, updatedBy: who }, update: { locked } });
  revalidatePath("/", "layout");
  return { ok: true, message: locked ? "Locked. The class teacher can view but not change it." : "Unlocked. The class teacher can edit it again." };
}
