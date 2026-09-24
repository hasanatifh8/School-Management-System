"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { readImportFile } from "@/lib/import/excel";
import { describeErrors, toBloodGroup, toGender, toIsoDate, type ImportRowResult, type ImportState } from "@/lib/import/rows";
import { fullName } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { DEFAULT_NATIONALITY } from "@/lib/student-options";
import { createStudentRecord } from "@/lib/students";
import { studentSchema, type StudentInput } from "../schema";

type Section = { id: string; name: string; class: { name: string; subjects: { subjectId: string }[] } };

/**
 * Checks (mode=preview) or imports (mode=import) students from the template.
 * Every row is validated with the same rules as the admission form; on import,
 * valid rows are created together and rows with errors are skipped.
 */
export async function importStudents(_: ImportState, formData: FormData): Promise<ImportState> {
  const school = await getCurrentSchool();
  const read = await readImportFile("students", formData.get("file"));
  if ("error" in read) return { error: read.error };

  const [classes, existing] = await Promise.all([
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      include: { sections: { include: { class: { include: { subjects: true } } } } },
    }),
    db.student.findMany({
      where: { schoolId: school.id },
      select: { firstName: true, lastName: true, dateOfBirth: true, studentCode: true, status: true, sectionId: true, rollNumber: true },
    }),
  ]);
  const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));

  // Roll numbers already used by active students, per section (grows as rows are checked).
  const takenRolls = new Map<string, Set<number>>();
  for (const s of existing) {
    if (s.status !== "ACTIVE" || !s.sectionId || s.rollNumber == null) continue;
    takenRolls.set(s.sectionId, (takenRolls.get(s.sectionId) ?? new Set()).add(s.rollNumber));
  }
  const identity = (first: string, last: string, dob: string) => `${first}|${last}|${dob}`.toLowerCase();
  const existingByIdentity = new Map(
    existing.map((s) => [identity(s.firstName, s.lastName, s.dateOfBirth?.toISOString().slice(0, 10) ?? ""), s.studentCode]),
  );
  const seenInFile = new Map<string, number>();

  const results: (ImportRowResult & { data?: StudentInput; section?: Section | null })[] = [];
  for (const { rowNumber, values: v } of read.rows) {
    const errors: string[] = [];
    const warnings: string[] = [];

    const dateOfBirth = toIsoDate(v.dateOfBirth ?? "");
    if (dateOfBirth === null) errors.push("Date of birth: use DD-MM-YYYY, e.g. 15-08-2015");
    const admissionDate = toIsoDate(v.admissionDate ?? "");
    if (admissionDate === null) errors.push("Admission date: use DD-MM-YYYY, e.g. 01-04-2026");
    const gender = toGender(v.gender ?? "");
    if (gender === null) errors.push("Gender: use Male, Female or Other");
    const bloodGroup = toBloodGroup(v.bloodGroup ?? "");
    if (bloodGroup === null) errors.push("Blood group: use A+, A-, B+, B-, AB+, AB-, O+ or O-");

    // Class and section by name.
    let section: Section | null = null;
    const className = (v.className ?? "").trim();
    const sectionName = (v.sectionName ?? "").trim().toUpperCase();
    if (className) {
      const cls = classByName.get(className.toLowerCase());
      if (!cls) errors.push(`Class “${className}” doesn't exist`);
      else if (sectionName) {
        section = cls.sections.find((s) => s.name.toUpperCase() === sectionName) ?? null;
        if (!section) errors.push(`Section “${sectionName}” doesn't exist in ${cls.name} (${cls.sections.map((s) => s.name).join(", ") || "no sections"})`);
      } else if (cls.sections.length === 1) {
        section = cls.sections[0];
      } else {
        errors.push(`Section is required for ${cls.name} (${cls.sections.map((s) => s.name).join(", ")})`);
      }
    } else if (sectionName) {
      errors.push("Class is required when Section is filled");
    }

    const parsed = studentSchema.safeParse({
      firstName: v.firstName ?? "",
      middleName: v.middleName ?? "",
      lastName: v.lastName ?? "",
      gender: gender ?? "",
      bloodGroup: bloodGroup ?? "",
      dateOfBirth: dateOfBirth ?? "",
      admissionDate: admissionDate ?? "",
      aadhaarNumber: v.aadhaarNumber ?? "",
      phone: v.phone ?? "",
      fatherName: v.fatherName ?? "",
      motherName: v.motherName ?? "",
      rollNumber: v.rollNumber ?? "",
      nationality: DEFAULT_NATIONALITY,
    });
    if (!parsed.success) errors.push(...describeErrors("students", parsed.error));

    const roll = parsed.success ? parsed.data.rollNumber : null;
    if (roll != null && !section && !errors.length) errors.push("Roll number needs a Class and Section");
    if (roll != null && section) {
      const taken = takenRolls.get(section.id) ?? new Set<number>();
      if (taken.has(roll)) errors.push(`Roll number ${roll} is already used in ${section.class.name} – ${section.name}`);
      else takenRolls.set(section.id, taken.add(roll));
    }

    const key = identity(v.firstName ?? "", v.lastName ?? "", dateOfBirth ?? "");
    if (v.firstName && v.lastName && dateOfBirth) {
      const code = existingByIdentity.get(key);
      if (code) warnings.push(`Possible duplicate of existing student ${code}`);
      const earlier = seenInFile.get(key);
      if (earlier) warnings.push(`Same name and date of birth as row ${earlier}`);
      else seenInFile.set(key, rowNumber);
    }

    results.push({
      rowNumber,
      name: fullName({ firstName: v.firstName || "—", middleName: v.middleName, lastName: v.lastName ?? "" }),
      detail: section ? `${section.class.name} – ${section.name}${roll != null ? ` · Roll ${roll}` : ""}` : "No class",
      errors,
      warnings,
      ...(errors.length === 0 && parsed.success && { data: parsed.data, section }),
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

  const session = await getCurrentSession(school.id);
  const codes = await db.$transaction(
    async (tx) => {
      const created: string[] = [];
      for (const r of valid) {
        const { admissionDate, ...data } = r.data!;
        const student = await createStudentRecord(tx, {
          schoolId: school.id,
          sessionId: session.id,
          data,
          section: r.section ?? null,
          admissionDate,
        });
        created.push(student.studentCode);
      }
      return created;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  revalidatePath("/admin", "layout");
  return { done: { created: codes.length, skipped: results.length - codes.length, codes } };
}
