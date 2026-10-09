// Display names for people and sections. No server-only imports, so client components can use them.

export function fullName(p: { firstName: string; middleName?: string | null; lastName: string }) {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

export function sectionLabel(s: { name: string; class: { name: string } }) {
  return `${s.class.name} – ${s.name}`;
}
