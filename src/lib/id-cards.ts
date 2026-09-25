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
};

export type IdCardStudent = {
  id: string;
  name: string;
  className: string;
  sectionName: string;
  roll: string;
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

  const cardSchool: IdCardSchool = {
    name: school.name,
    motto: school.motto,
    address: school.address,
    phone: school.phone,
    email: school.email,
    website: school.website,
    principalName: school.principalName,
    logoUrl: schoolLogoUrl(school),
  };
  const sectionIds = [...new Set(students.flatMap((s) => (s.sectionId ? [s.sectionId] : [])))];
  return { school: cardSchool, cards, validTill: valid, session, sectionIds };
}
