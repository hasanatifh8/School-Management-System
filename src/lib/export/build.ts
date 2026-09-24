import "server-only";
import ExcelJS from "exceljs";
import type { Prisma } from "@/generated/prisma/client";
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

type StudentForExport = Prisma.StudentGetPayload<{ include: { section: { include: { class: true } }; house: true } }>;

function studentValues(s: StudentForExport) {
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
}

type TeacherForExport = Prisma.TeacherGetPayload<{
  include: {
    classTeacherOf: { include: { class: true } };
    subjectAssignments: { include: { subject: true; section: { include: { class: true } } } };
  };
}>;

function teacherValues(t: TeacherForExport) {
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
}

async function studentRows(schoolId: string, params: URLSearchParams) {
  const f = parseStudentFilters(params);
  const students = await db.student.findMany({
    where: { ...studentWhere(schoolId, f), status: f.removed ? "INACTIVE" : "ACTIVE" },
    orderBy: studentOrder(f),
    include: { section: { include: { class: true } }, house: true },
  });
  return students.map(studentValues);
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
  return teachers.map(teacherValues);
}

type Column = { key: string; label: string };

/** Adds a formatted sheet: coloured frozen header, autofilter, real dates, fitted widths. */
function addSheet(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, Cell>[]) {
  const sheet = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
  for (const r of rows) sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? null])));

  columns.forEach((_, i) => {
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
  if (columns.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
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
  addSheet(wb, kind === "students" ? "Students" : "Teachers", columns, rows);
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), count: rows.length };
}

/**
 * Full backup of one school as a multi-sheet workbook: profile, students and
 * teachers (all columns, active and removed), classes, subjects, houses and sessions.
 */
export async function buildSchoolBackup(schoolId: string) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const [students, teachers, classes, subjects, houses, sessions] = await Promise.all([
    db.student.findMany({
      where: { schoolId },
      orderBy: { studentCode: "asc" },
      include: { section: { include: { class: true } }, house: true },
    }),
    db.teacher.findMany({
      where: { schoolId },
      orderBy: { employeeCode: "asc" },
      include: {
        classTeacherOf: { include: { class: true } },
        subjectAssignments: { include: { subject: true, section: { include: { class: true } } } },
      },
    }),
    db.schoolClass.findMany({
      where: { schoolId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        sections: { orderBy: { name: "asc" }, include: { classTeacher: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } },
        subjects: { include: { subject: true } },
      },
    }),
    db.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" }, include: { classes: { include: { class: true } } } }),
    db.house.findMany({ where: { schoolId }, orderBy: { name: "asc" }, include: { _count: { select: { students: true } } } }),
    db.academicSession.findMany({ where: { schoolId }, orderBy: { startDate: "asc" }, include: { _count: { select: { enrollments: true } } } }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "School Management System";
  const kv = (label: string, value: Cell) => ({ field: label, value });
  addSheet(wb, "School", [{ key: "field", label: "Field" }, { key: "value", label: "Value" }], [
    kv("Name", school.name),
    kv("Code", school.code),
    kv("Status", school.status === "ACTIVE" ? "Active" : "Suspended"),
    kv("Board", school.board),
    kv("Principal", school.principalName),
    kv("Established", school.establishedYear),
    kv("Motto", school.motto),
    kv("Address", school.address),
    kv("Phone", school.phone),
    kv("Email", school.email),
    kv("Website", school.website),
    kv("Backup taken", new Date()),
  ]);
  addSheet(wb, "Students", EXPORT_FIELDS.students, students.map(studentValues));
  addSheet(wb, "Teachers", EXPORT_FIELDS.teachers, teachers.map(teacherValues));
  addSheet(
    wb,
    "Classes",
    [
      { key: "cls", label: "Class" },
      { key: "section", label: "Section" },
      { key: "teacher", label: "Class teacher" },
      { key: "students", label: "Active students" },
      { key: "subjects", label: "Subjects" },
    ],
    classes.flatMap((c) =>
      (c.sections.length ? c.sections : [null]).map((sec) => ({
        cls: c.name,
        section: sec?.name ?? null,
        teacher: sec?.classTeacher ? fullName(sec.classTeacher) : null,
        students: sec?._count.students ?? 0,
        subjects: c.subjects.map((x) => x.subject.name).join(", "),
      })),
    ),
  );
  addSheet(
    wb,
    "Subjects",
    [
      { key: "name", label: "Subject" },
      { key: "code", label: "Code" },
      { key: "classes", label: "Taught in" },
    ],
    subjects.map((x) => ({ name: x.name, code: x.code, classes: x.classes.map((c) => c.class.name).join(", ") })),
  );
  addSheet(
    wb,
    "Houses",
    [
      { key: "name", label: "House" },
      { key: "color", label: "Colour" },
      { key: "motto", label: "Motto" },
      { key: "students", label: "Students" },
    ],
    houses.map((h) => ({ name: h.name, color: h.color, motto: h.description, students: h._count.students })),
  );
  addSheet(
    wb,
    "Sessions",
    [
      { key: "name", label: "Session" },
      { key: "start", label: "Starts" },
      { key: "end", label: "Ends" },
      { key: "status", label: "Status" },
      { key: "students", label: "Students enrolled" },
    ],
    sessions.map((x) => ({ name: x.name, start: x.startDate, end: x.endDate, status: x.status, students: x._count.enrollments })),
  );

  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), school };
}
