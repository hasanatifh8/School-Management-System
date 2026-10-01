"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { audit, deleteRemovedPeople, type PersonKind } from "@/lib/power-tools";
import { getCurrentSchool, getViewer } from "@/lib/school";

const NOUNS: Record<PersonKind, [string, string]> = {
  student: ["student", "students"],
  teacher: ["teacher", "teachers"],
  staff: ["staff member", "staff members"],
};
const LISTS: Record<PersonKind, string> = { student: "/admin/students", teacher: "/admin/teachers", staff: "/admin/staff" };

/**
 * Permanently deletes one removed person (`id`) or every removed person of a
 * kind (`id` null). Only people already removed can be deleted, and the admin
 * types the school code to confirm. Full admins and Power Admin only.
 */
export async function deletePermanently(kind: PersonKind, id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const typed = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (typed !== school.code.toUpperCase()) {
    const message = `Type ${school.code} to confirm.`;
    return { error: message, fieldErrors: { confirm: [message] } };
  }

  const deleted = await db.$transaction((tx) => deleteRemovedPeople(tx, school.id, kind, id ? [id] : null), { timeout: 60_000, maxWait: 10_000 });
  const [one, many] = NOUNS[kind];
  if (!deleted) return { error: id ? `Only a removed ${one} can be deleted permanently.` : `There are no removed ${many} to delete.` };

  const viewer = await getViewer();
  const who = viewer?.kind === "admin" ? `${viewer.admin.name} (school admin)` : "Power Admin";
  await audit(`Removed ${many} deleted permanently`, school, `${deleted} ${deleted === 1 ? one : many} by ${who}`);
  revalidatePath("/admin", "layout");
  if (id) redirect(`${LISTS[kind]}?status=removed`);
  return { ok: true, message: `Permanently deleted ${deleted} ${deleted === 1 ? one : many}.` };
}
