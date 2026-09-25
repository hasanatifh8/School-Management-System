// Filters for the Students and Teachers lists, read from the URL. The list
// pages and the Excel export share them so an export matches what is shown.
import type { Prisma } from "@/generated/prisma/client";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: Params, key: string) {
  const v = params instanceof URLSearchParams ? params.get(key) : params[key];
  return typeof v === "string" ? v.trim() : "";
}

const oneOf = <T extends string>(value: string, allowed: readonly T[]) =>
  (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/**
 * Each word must match at least one of the fields, so "dev joshi" finds
 * "Dev Kumar Joshi" and "aarav 9810" matches a name and a phone number.
 */
function wordSearch<Where>(q: string, fields: string[]): { AND: Where[] } | Record<string, never> {
  const words = q.split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return {};
  return {
    AND: words.map((word) => ({ OR: fields.map((field) => ({ [field]: { contains: word, mode: "insensitive" } })) }) as Where),
  };
}

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const BLOOD_GROUPS = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"] as const;
const CATEGORIES = ["GENERAL", "OBC", "SC_ST", "MINORITY"] as const;
const TEACHER_ROLES = ["class", "subject", "none"] as const;

/* ───────────────────────── Students ───────────────────────── */

export function parseStudentFilters(params: Params) {
  return {
    q: read(params, "q"),
    classId: read(params, "classId"),
    sectionId: read(params, "sectionId"),
    houseId: read(params, "houseId"),
    gender: oneOf(read(params, "gender"), GENDERS),
    category: oneOf(read(params, "category"), CATEGORIES),
    bloodGroup: oneOf(read(params, "bloodGroup"), BLOOD_GROUPS),
    removed: read(params, "status") === "removed",
  };
}

export type StudentFilters = ReturnType<typeof parseStudentFilters>;

/** Where-clause for everything except the Active/Removed status. */
export function studentWhere(schoolId: string, f: StudentFilters): Prisma.StudentWhereInput {
  return {
    schoolId,
    ...(f.sectionId ? { sectionId: f.sectionId } : f.classId ? { section: { classId: f.classId } } : {}),
    ...(f.houseId && { houseId: f.houseId === "none" ? null : f.houseId }),
    ...(f.gender && { gender: f.gender }),
    ...(f.category && { category: f.category }),
    ...(f.bloodGroup && { bloodGroup: f.bloodGroup }),
    ...wordSearch<Prisma.StudentWhereInput>(f.q, [
      "firstName",
      "middleName",
      "lastName",
      "studentCode",
      "fatherName",
      "motherName",
      "guardianName",
      "phone",
    ]),
  };
}

/** Within one class, list by section and roll number; otherwise by student ID. */
export function studentOrder(f: StudentFilters): Prisma.StudentOrderByWithRelationInput[] {
  return f.classId || f.sectionId
    ? [{ section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }]
    : [{ studentCode: "asc" }];
}

/* ───────────────────────── Teachers ───────────────────────── */

export function parseTeacherFilters(params: Params) {
  return {
    q: read(params, "q"),
    role: oneOf(read(params, "role"), TEACHER_ROLES),
    subjectId: read(params, "subjectId"),
    gender: oneOf(read(params, "gender"), GENDERS),
    bloodGroup: oneOf(read(params, "bloodGroup"), BLOOD_GROUPS),
    removed: read(params, "status") === "removed",
  };
}

export type TeacherFilters = ReturnType<typeof parseTeacherFilters>;

export function teacherWhere(schoolId: string, f: TeacherFilters): Prisma.TeacherWhereInput {
  const role: Prisma.TeacherWhereInput =
    f.role === "class"
      ? { classTeacherOf: { isNot: null } }
      : f.role === "subject"
        ? { subjectAssignments: { some: {} } }
        : f.role === "none"
          ? { classTeacherOf: { is: null }, subjectAssignments: { none: {} } }
          : {};
  return {
    schoolId,
    ...role,
    ...(f.subjectId && { subjectAssignments: { some: { subjectId: f.subjectId } } }),
    ...(f.gender && { gender: f.gender }),
    ...(f.bloodGroup && { bloodGroup: f.bloodGroup }),
    ...wordSearch<Prisma.TeacherWhereInput>(f.q, [
      "firstName",
      "middleName",
      "lastName",
      "employeeCode",
      "phone",
      "email",
      "specialization",
    ]),
  };
}
