"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextTeacherCode } from "@/lib/codes";
import { readImportFile } from "@/lib/import/excel";
import { describeErrors, toBloodGroup, toGender, toIsoDate, type ImportRowResult, type ImportState } from "@/lib/import/rows";
import { fullName } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { teacherSchema, type TeacherInput } from "../schema";

/**
 * Checks (mode=preview) or imports (mode=import) teachers from the template,
 * validating each row like the teacher form. Rows with errors are skipped.
 */
export async function importTeachers(_: ImportState, formData: FormData): Promise<ImportState> {
  const school = await getCurrentSchool();
  const read = await readImportFile("teachers", formData.get("file"));
  if ("error" in read) return { error: read.error };

  const existing = await db.teacher.findMany({
    where: { schoolId: school.id },
    select: { employeeCode: true, email: true, phone: true },
  });
  const byEmail = new Map(existing.filter((t) => t.email).map((t) => [t.email!.toLowerCase(), t.employeeCode]));
  const byPhone = new Map(existing.filter((t) => t.phone).map((t) => [t.phone!.replace(/\D/g, ""), t.employeeCode]));
  const emailsInFile = new Map<string, number>();

  const results: (ImportRowResult & { data?: TeacherInput })[] = [];
  for (const { rowNumber, values: v } of read.rows) {
    const errors: string[] = [];
    const warnings: string[] = [];

    const joiningDate = toIsoDate(v.joiningDate ?? "");
    if (joiningDate === null) errors.push("Joining date: use DD-MM-YYYY, e.g. 01-04-2026");
    const dateOfBirth = toIsoDate(v.dateOfBirth ?? "");
    if (dateOfBirth === null) errors.push("Date of birth: use DD-MM-YYYY, e.g. 12-06-1988");
    const gender = toGender(v.gender ?? "");
    if (gender === null) errors.push("Gender: use Male, Female or Other");
    const bloodGroup = toBloodGroup(v.bloodGroup ?? "");
    if (bloodGroup === null) errors.push("Blood group: use A+, A-, B+, B-, AB+, AB-, O+ or O-");

    const parsed = teacherSchema.safeParse({
      firstName: v.firstName ?? "",
      middleName: v.middleName ?? "",
      lastName: v.lastName ?? "",
      gender: gender ?? "",
      bloodGroup: bloodGroup ?? "",
      email: v.email ?? "",
      phone: v.phone ?? "",
      qualification: v.qualification ?? "",
      joiningDate: joiningDate ?? "",
      dateOfBirth: dateOfBirth ?? "",
      whatsappNumber: v.whatsappNumber ?? "",
      address: v.address ?? "",
      specialization: v.specialization ?? "",
      experienceYears: v.experienceYears ?? "",
      monthlySalary: v.monthlySalary ?? "",
    });
    if (!parsed.success) errors.push(...describeErrors("teachers", parsed.error));

    const email = (v.email ?? "").trim().toLowerCase();
    const phone = (v.phone ?? "").replace(/\D/g, "");
    if (email && byEmail.has(email)) warnings.push(`Email already used by ${byEmail.get(email)}`);
    if (phone && byPhone.has(phone)) warnings.push(`Phone already used by ${byPhone.get(phone)}`);
    if (email) {
      const earlier = emailsInFile.get(email);
      if (earlier) warnings.push(`Same email as row ${earlier}`);
      else emailsInFile.set(email, rowNumber);
    }

    results.push({
      rowNumber,
      name: fullName({ firstName: v.firstName || "—", middleName: v.middleName, lastName: v.lastName ?? "" }),
      detail: [v.specialization || v.qualification, v.phone].filter(Boolean).join(" · ") || "—",
      errors,
      warnings,
      ...(errors.length === 0 && parsed.success && { data: parsed.data }),
    });
  }

  const valid = results.filter((r) => r.data);
  const preview = {
    fileName: (formData.get("file") as File).name,
    rows: results.map(({ rowNumber, name, detail, errors, warnings }) => ({ rowNumber, name, detail, errors, warnings })),
    valid: valid.length,
    invalid: results.length - valid.length,
  };
  if (formData.get("mode") !== "import") return { preview };
  if (!valid.length) return { preview, error: "There are no valid rows to import." };

  const codes = await db.$transaction(
    async (tx) => {
      const created: string[] = [];
      for (const r of valid) {
        const { joiningDate, ...data } = r.data!;
        const teacher = await tx.teacher.create({
          data: {
            ...data,
            schoolId: school.id,
            employeeCode: await nextTeacherCode(tx, school.id),
            joiningDate: joiningDate ?? new Date(),
          },
        });
        created.push(teacher.employeeCode);
      }
      return created;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  revalidatePath("/admin", "layout");
  return { done: { created: codes.length, skipped: results.length - codes.length, codes } };
}
