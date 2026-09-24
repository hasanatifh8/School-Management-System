import "server-only";
import { db } from "@/lib/db";

/** Classes with their sections, in display order — for section pickers. */
export function getClassesWithSections(schoolId: string) {
  return db.schoolClass.findMany({
    where: { schoolId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { sections: { orderBy: { name: "asc" } } },
  });
}

/** Houses for pickers, alphabetically. */
export function getHouses(schoolId: string) {
  return db.house.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
}

/** Finds a section only if it belongs to the given school. */
export function findSchoolSection(schoolId: string, sectionId: string) {
  return db.section.findFirst({
    where: { id: sectionId, class: { schoolId } },
    include: { class: { include: { subjects: true } } },
  });
}

export function fullName(p: { firstName: string; middleName?: string | null; lastName: string }) {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

export function sectionLabel(s: { name: string; class: { name: string } }) {
  return `${s.class.name} – ${s.name}`;
}
