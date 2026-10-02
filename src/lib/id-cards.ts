import "server-only";
import QRCode from "qrcode";
import type { Prisma } from "@/generated/prisma/client";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { schoolLogoUrl } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";

const dmy = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const validTill = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export type IdCardSchool = {
  name: string;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  principalName: string | null;
  logoUrl: string | null;
  /** Back of every card: emergency contacts and guidelines, one per line. */
  emergency: string[];
  guidelines: string[];
};

/** Guidelines printed on the back when the school hasn't written its own. */
export const DEFAULT_GUIDELINES = [
  "This card is not transferable.",
  "Carry it at all times in school and on school transport.",
  "Report a lost card to the school office at once.",
];

const lines = (text: string | null | undefined) =>
  (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

type SchoolRow = Prisma.SchoolGetPayload<{ include: { logo: { select: { updatedAt: true } } } }>;

/** The school's details for the card, with the default back text where none is set. */
function cardSchool(school: SchoolRow): IdCardSchool {
  const emergency = lines(school.idCardEmergency);
  const guidelines = lines(school.idCardGuidelines);
  return {
    name: school.name,
    motto: school.motto,
    address: school.address,
    phone: school.phone,
    email: school.email,
    website: school.website,
    principalName: school.principalName,
    logoUrl: schoolLogoUrl(school),
    emergency: emergency.length ? emergency.slice(0, 4) : school.phone ? [`School office: ${school.phone}`] : [],
    guidelines: (guidelines.length ? guidelines : DEFAULT_GUIDELINES).slice(0, 5),
  };
}

export type IdCardStudent = {
  id: string;
  name: string;
  className: string;
  sectionName: string;
  roll: string;
  fatherName: string;
  address: string;
  admissionNo: string;
  dob: string;
  bloodGroup: string;
  parentContact: string;
  photoUrl: string | null;
  qrSvg: string;
  missing: string[];
};

/** The most cards generated at once, so the page stays quick. */
export const MAX_CARDS_PER_BATCH = 100;

function missingDetails(s: { photoId: string | null; sectionId: string | null; rollNumber: number | null; dateOfBirth: Date | null; phone: string | null }) {
  return [
    !s.photoId && "photo",
    !s.sectionId && "class",
    s.rollNumber == null && "roll number",
    !s.dateOfBirth && "date of birth",
    !s.phone && "parent contact",
  ].filter((x): x is string => !!x);
}

/** A light list of a class's students for choosing whose cards to make (no card data). */
export async function loadIdCardRoster(schoolId: string, sectionId: string) {
  const students = await db.student.findMany({
    where: { schoolId, sectionId, status: "ACTIVE" },
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      studentCode: true,
      rollNumber: true,
      photoId: true,
      sectionId: true,
      dateOfBirth: true,
      phone: true,
    },
  });
  return students.map((s) => ({
    id: s.id,
    name: fullName(s),
    code: s.studentCode,
    roll: s.rollNumber,
    photoUrl: photoUrl(s.photoId),
    missing: missingDetails(s),
  }));
}

export type RosterStudent = Awaited<ReturnType<typeof loadIdCardRoster>>[number];

/**
 * Everything needed to print ID cards for the students matching `where`
 * (always limited to active students of `schoolId`).
 */
export async function loadIdCards(schoolId: string, where: Prisma.StudentWhereInput) {
  const [school, session, students] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId }, include: { logo: { select: { updatedAt: true } } } }),
    getCurrentSession(schoolId),
    db.student.findMany({
      where: { ...where, schoolId, status: "ACTIVE" },
      include: { section: { include: { class: true } } },
      take: MAX_CARDS_PER_BATCH,
      orderBy: [
        { section: { class: { sortOrder: "asc" } } },
        { section: { name: "asc" } },
        { rollNumber: { sort: "asc", nulls: "last" } },
        { firstName: "asc" },
      ],
    }),
  ]);
  const valid = validTill.format(session.endDate);

  const cards: IdCardStudent[] = await Promise.all(
    students.map(async (s) => {
      const name = fullName(s);
      const dob = s.dateOfBirth ? dmy.format(s.dateOfBirth).replace(/\//g, "-") : "";
      const blood = s.bloodGroup ? BLOOD_GROUP_LABELS[s.bloodGroup] : "";
      const parent = [s.fatherName ?? s.guardianName, s.phone].filter(Boolean).join(" · ");
      // Plain text, so any phone camera shows it without an app or internet.
      // Kept short: fewer characters mean bigger squares that scan more easily.
      const qrText = [
        school.name,
        `Name: ${name}`,
        `Adm No: ${s.studentCode}`,
        s.section && `Class: ${s.section.class.name}-${s.section.name}${s.rollNumber != null ? `, Roll ${s.rollNumber}` : ""}`,
        dob && `DOB: ${dob}`,
        blood && `Blood: ${blood}`,
        parent && `Parent: ${parent}`,
      ]
        .filter(Boolean)
        .join("\n");
      const qrSvg = await QRCode.toString(qrText, { type: "svg", margin: 1, errorCorrectionLevel: "L", color: { dark: "#0b2554", light: "#ffffff" } });
      return {
        id: s.id,
        name,
        className: s.section?.class.name ?? "",
        sectionName: s.section?.name ?? "",
        roll: s.rollNumber != null ? String(s.rollNumber) : "",
        fatherName: s.fatherName ?? "",
        address: (s.primaryAddress ?? s.correspondenceAddress ?? "").replace(/\s*\n\s*/g, ", "),
        admissionNo: s.studentCode,
        dob,
        bloodGroup: blood,
        parentContact: s.phone ?? "",
        photoUrl: photoUrl(s.photoId),
        qrSvg,
        missing: missingDetails(s),
      };
    }),
  );

  const sectionIds = [...new Set(students.flatMap((s) => (s.sectionId ? [s.sectionId] : [])))];
  return { school: cardSchool(school), cards, validTill: valid, session, sectionIds };
}

/* ───────────────────────── Staff cards ───────────────────────── */

export type IdCardStaff = {
  /** "t:<teacherId>" or "s:<staffId>", as in the ?ids= list. */
  key: string;
  id: string;
  teaching: boolean;
  name: string;
  employeeCode: string;
  designation: string;
  department: string;
  bloodGroup: string;
  contact: string;
  address: string;
  photoUrl: string | null;
  qrSvg: string;
  missing: string[];
};

/** Teachers and staff for choosing whose cards to make. */
export async function loadStaffIdCardRoster(schoolId: string) {
  const [teachers, staff] = await Promise.all([
    db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  const missing = (p: { photoId: string | null; phone: string | null; bloodGroup: unknown }) =>
    [!p.photoId && "photo", !p.phone && "contact", !p.bloodGroup && "blood group"].filter((x): x is string => !!x);
  return [
    ...teachers.map((t) => ({ id: `t:${t.id}`, name: fullName(t), code: t.employeeCode, sub: "Teaching", profile: `/teachers/${t.id}`, photoUrl: photoUrl(t.photoId), missing: missing(t) })),
    ...staff.map((s) => ({ id: `s:${s.id}`, name: s.name, code: s.employeeCode, sub: `Non-teaching · ${s.designation}`, profile: `/staff/${s.id}`, photoUrl: photoUrl(s.photoId), missing: missing(s) })),
  ];
}

/** Card data for the given keys ("t:<id>" teachers, "s:<id>" staff). */
export async function loadStaffIdCards(schoolId: string, keys: string[]) {
  const teacherIds = keys.filter((k) => k.startsWith("t:")).map((k) => k.slice(2));
  const staffIds = keys.filter((k) => k.startsWith("s:")).map((k) => k.slice(2));
  const [school, session, teachers, staff] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId }, include: { logo: { select: { updatedAt: true } } } }),
    getCurrentSession(schoolId),
    db.teacher.findMany({
      where: { id: { in: teacherIds }, schoolId, status: "ACTIVE" },
      include: { classTeacherOf: { include: { class: true } } },
    }),
    db.staffMember.findMany({ where: { id: { in: staffIds }, schoolId, status: "ACTIVE" } }),
  ]);

  const card = async (p: Omit<IdCardStaff, "qrSvg" | "missing"> & { photoId: string | null }): Promise<IdCardStaff> => {
    const qrText = [school.name, `Name: ${p.name}`, `Emp ID: ${p.employeeCode}`, `${p.designation}${p.department ? `, ${p.department}` : ""}`, p.bloodGroup && `Blood: ${p.bloodGroup}`, p.contact && `Phone: ${p.contact}`]
      .filter(Boolean)
      .join("\n");
    const qrSvg = await QRCode.toString(qrText, { type: "svg", margin: 1, errorCorrectionLevel: "L", color: { dark: "#0b2554", light: "#ffffff" } });
    const { photoId, ...rest } = p;
    return { ...rest, qrSvg, missing: [!photoId && "photo", !p.contact && "contact", !p.bloodGroup && "blood group", !p.address && "address"].filter((x): x is string => !!x) };
  };
  const oneLine = (a: string | null) => (a ?? "").replace(/\s*\n\s*/g, ", ");

  const byKey = new Map<string, IdCardStaff>();
  for (const t of teachers) {
    byKey.set(
      `t:${t.id}`,
      await card({
        key: `t:${t.id}`,
        id: t.id,
        teaching: true,
        name: fullName(t),
        employeeCode: t.employeeCode,
        designation: t.classTeacherOf ? `Class teacher, ${t.classTeacherOf.class.name}-${t.classTeacherOf.name}` : "Teacher",
        department: t.specialization || "Teaching",
        bloodGroup: t.bloodGroup ? BLOOD_GROUP_LABELS[t.bloodGroup] : "",
        contact: t.phone ?? "",
        address: oneLine(t.address),
        photoUrl: photoUrl(t.photoId),
        photoId: t.photoId,
      }),
    );
  }
  for (const s of staff) {
    byKey.set(
      `s:${s.id}`,
      await card({
        key: `s:${s.id}`,
        id: s.id,
        teaching: false,
        name: s.name,
        employeeCode: s.employeeCode,
        designation: s.designation,
        department: s.department || "Non-teaching",
        bloodGroup: s.bloodGroup ? BLOOD_GROUP_LABELS[s.bloodGroup] : "",
        contact: s.phone ?? "",
        address: oneLine(s.address),
        photoUrl: photoUrl(s.photoId),
        photoId: s.photoId,
      }),
    );
  }
  // Keep the order they were picked in.
  const cards = keys.map((k) => byKey.get(k)).filter((c): c is IdCardStaff => !!c);
  return { school: cardSchool(school), cards, validTill: validTill.format(session.endDate) };
}
