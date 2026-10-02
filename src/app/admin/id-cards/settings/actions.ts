"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";

const clean = (v: FormDataEntryValue | null, maxLines: number) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim().slice(0, 90))
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n") || null;

/** The emergency contacts and guidelines printed on the back of every ID card. */
export async function saveCardBack(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  await db.school.update({
    where: { id: school.id },
    data: { idCardEmergency: clean(formData.get("emergency"), 4), idCardGuidelines: clean(formData.get("guidelines"), 5) },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Card back saved. New cards use it." };
}
