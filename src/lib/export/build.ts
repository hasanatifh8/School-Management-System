import "server-only";
import ExcelJS from "exceljs";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { db } from "@/lib/db";
import { EXPORT_FIELDS, type ExportKind } from "@/lib/export/fields";
import {
  parseStudentFilters,
  parseTeacherFilters,
  studentOrder,
  studentWhere,
  teacherWhere,
} from "@/lib/list-filters";
import { fullName, sectionLabel } from "@/lib/queries";
import { CATEGORY_LABELS } from "@/lib/student-options";

type Cell = string | number | Date | null | undefined;

const GENDER_LABELS: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const label = (map: Record<string, string>, v: string | null) => (v ? map[v] ?? v : null);

async function studentRows(schoolId: string, params: URLSearchParams) {
  const f = parseStudentFilters(params);
  const students = await db.student.findMany({
    where: { ...studentWhere(schoolId, f), status: f.removed ? "INACTIVE" : "ACTIVE" },
    orderBy: studentOrder(f),
    include: { section: { include: { class: true } }, house: true },
  });
  return students.map((s) => {
    const values: Record<string, Cell> = {
      studentCode: s.studentCode,
      fullName: fullName(s),
      firstName: s.firstName,
      middleName: s.middleName,
      lastName: s.lastName,
      gender: label(GENDER_LABELS, s.gender),
      dateOfBirth: s.dateOfBirth,
      bloodGroup: label(BLOOD_GROUP_LABELS, s.bloodGroup),
      status: s.status === "ACTIVE" ? "Active" : "Removed",
      classSection: s.section ? sectionLabel(s.section) : null,
      className: s.section?.class.name,
      sectionName: s.section?.name,
      rollNumber: s.rollNumber,
      house: s.house?.name,
      admissionDate: s.admissionDate,
      lastSchoolName: s.lastSchoolName,
      fatherName: s.fatherName,
      motherName: s.motherName,
      phone: s.phone,
      whatsappNumber: s.whatsappNumber,
      email: s.email,
      primaryAddress: s.primaryAddress,
      correspondenceAddress: s.correspondenceAddress,
      aadhaarNumber: s.aadhaarNumber,
      category: label(CATEGORY_LABELS, s.category),
      religion: s.religion,
      caste: s.caste,
      nationality: s.nationality,
    };
    return values;
  });
}

async function teacherRows(schoolId: string, params: URLSearchParams) {
  const f = parseTeacherFilters(params);
  const teachers = await db.teacher.findMany({
    where: { ...teacherWhere(schoolId, f), status: f.removed ? "INACTIVE" : "ACTIVE" },
    orderBy: { employeeCode: "asc" },
    include: {
      classTeacherOf: { include: { class: true } },
      subjectAssignments: { include: { subject: true, section: { include: { class: true } } } },
    },
  });
  return teachers.map((t) => {
    const values: Record<string, Cell> = {
      employeeCode: t.employeeCode,
      fullName: fullName(t),
      firstName: t.firstName,
      middleName: t.middleName,
      lastName: t.lastName,
      gender: label(GENDER_LABELS, t.gender),
      bloodGroup: label(BLOOD_GROUP_LABELS, t.bloodGroup),
      status: t.status === "ACTIVE" ? "Active" : "Removed",
      phone: t.phone,
      email: t.email,
      qualification: t.qualification,
      joiningDate: t.joiningDate,
      classTeacherOf: t.classTeacherOf ? sectionLabel(t.classTeacherOf) : null,
      subjectsTaught: t.subjectAssignments.map((a) => `${a.subject.name} (${sectionLabel(a.section)})`).join(", "),
    };
    return values;
  });
}

/**
 * Builds an .xlsx of the students or teachers matching the list filters in
 * `params`, with only the requested columns (in the order they are defined).
 */
export async function buildExport(kind: ExportKind, schoolId: string, params: URLSearchParams) {
  const wanted = new Set((params.get("fields") ?? "").split(",").filter(Boolean));
  const fields = EXPORT_FIELDS[kind].filter((f) => wanted.has(f.key));
  const columns = fields.length ? fields : EXPORT_FIELDS[kind].filter((f) => f.default);
  const rows = kind === "students" ? await studentRows(schoolId, params) : await teacherRows(schoolId, params);

  const wb = new ExcelJS.Workbook();
  wb.creator = "School Management System";
  const sheet = wb.addWorksheet(kind === "students" ? "Students" : "Teachers", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
  for (const r of rows) sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? null])));

  // Dates as real Excel dates; widths to fit the content.
  columns.forEach((c, i) => {
    const col = sheet.getColumn(i + 1);
    let width = col.width ?? 12;
    col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber > 1 && cell.value instanceof Date) cell.numFmt = "dd-mm-yyyy";
      const text = cell.value instanceof Date ? "00-00-0000" : String(cell.value ?? "");
      width = Math.max(width, Math.min(60, text.length + 2));
    });
    col.width = width;
  });
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  header.height = 20;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), count: rows.length };
}
