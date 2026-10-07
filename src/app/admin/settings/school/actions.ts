"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, validationError } from "@/lib/action-state";
import { db } from "@/lib/db";
import { readPhotoUpload } from "@/lib/photos";
import { audit } from "@/lib/power-tools";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { schoolSchema } from "@/lib/school-schema";

// The code identifies the school across the system; only Power Admin changes it.
const detailsSchema = schoolSchema.omit({ code: true });

/** The school's own profile: name, logo, affiliation and contact details. */
export async function saveSchoolDetails(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const logo = await readPhotoUpload(formData, "logo");
  if ("error" in logo) return { error: logo.error, fieldErrors: { logo: [logo.error] } };

  await db.$transaction(async (tx) => {
    await tx.school.update({ where: { id: school.id }, data: parsed.data });
    if (logo.photo) {
      await tx.schoolLogo.upsert({ where: { schoolId: school.id }, create: { schoolId: school.id, ...logo.photo }, update: logo.photo });
    } else if (formData.get("removeLogo") === "on") {
      await tx.schoolLogo.deleteMany({ where: { schoolId: school.id } });
    }
  });
  const viewer = await getViewer();
  await audit("School details updated", { id: school.id, name: parsed.data.name }, viewer?.kind === "admin" ? `By ${viewer.admin.email}` : undefined);
  revalidatePath("/", "layout");
  return { ok: true, message: "School details saved." };
}
