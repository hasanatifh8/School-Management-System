// Display names for people and sections. No server-only imports, so client components can use them.

export function fullName(p: { firstName: string; middleName?: string | null; lastName: string }) {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

// A class that isn't divided into sections keeps one section with an empty name, so students,
// attendance and exams still hang off a section. These helpers show such a class by its name alone.

/** "Class 6" + "A" → "Class 6 – A"; "Class 6" + "" → "Class 6". */
export function classSectionName(className: string, sectionName: string | null | undefined, sep = " – ") {
  return sectionName ? `${className}${sep}${sectionName}` : className;
}

export function sectionLabel(s: { name: string; class: { name: string } }) {
  return classSectionName(s.class.name, s.name);
}

/** "Section A", or "Whole class" for a class without sections. */
export function sectionTitle(name: string) {
  return name ? `Section ${name}` : "Whole class";
}

/** The section's name for small tiles and badges; a dash for a class without sections. */
export function sectionTag(name: string) {
  return name || "–";
}
