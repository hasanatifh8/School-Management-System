"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { HOUSE_COLOR_KEYS, type HouseColor } from "@/lib/houses";
import { type ActionState, optionalText, validationError } from "@/lib/action-state";

const houseSchema = z.object({
  name: z.string().trim().min(1, "House name is required").max(60),
  color: z.enum(HOUSE_COLOR_KEYS as [HouseColor, ...HouseColor[]], { message: "Choose a colour" }),
  description: optionalText,
});

async function findHouse(schoolId: string, id: string) {
  const house = await db.house.findFirst({ where: { id, schoolId } });
  if (!house) throw new Error("House not found");
  return house;
}

/** Case-insensitive name clash with another house in the school. */
async function nameTaken(schoolId: string, name: string, exceptId?: string) {
  const clash = await db.house.findFirst({
    where: { schoolId, name: { equals: name, mode: "insensitive" }, ...(exceptId && { id: { not: exceptId } }) },
  });
  return Boolean(clash);
}

export async function createHouse(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = houseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (await nameTaken(school.id, parsed.data.name)) {
    return { error: `${parsed.data.name} already exists.`, fieldErrors: { name: ["A house with this name exists"] } };
  }
  await db.house.create({ data: { ...parsed.data, schoolId: school.id } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Added ${parsed.data.name}.` };
}

export async function updateHouse(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findHouse(school.id, id);
  const parsed = houseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (await nameTaken(school.id, parsed.data.name, id)) {
    return { error: `${parsed.data.name} already exists.`, fieldErrors: { name: ["A house with this name exists"] } };
  }
  await db.house.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}

/** Deleting a house leaves its students without a house (they are not deleted). */
export async function deleteHouse(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findHouse(school.id, id);
  await db.house.delete({ where: { id } });
  revalidatePath("/admin", "layout");
  redirect("/admin/houses");
}

/** Puts the selected students in this house, moving them from any other house. */
export async function assignStudentsToHouse(
  houseId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const school = await getCurrentSchool();
  const house = await findHouse(school.id, houseId);
  const ids = formData.getAll("studentIds").map(String);
  if (!ids.length) return { error: "Select at least one student." };

  const { count } = await db.student.updateMany({
    where: { id: { in: ids }, schoolId: school.id },
    data: { houseId },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${count} student(s) added to ${house.name}.` };
}

export async function removeStudentFromHouse(houseId: string, studentId: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  await findHouse(school.id, houseId);
  await db.student.updateMany({
    where: { id: studentId, schoolId: school.id, houseId },
    data: { houseId: null },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Removed from house." };
}
