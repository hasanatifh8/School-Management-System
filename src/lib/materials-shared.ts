// Study material labels, shared by the server and the forms in the browser.

export const MATERIAL_KINDS = ["NOTES", "ASSIGNMENT", "TEST_PAPER", "SYLLABUS", "OTHER"] as const;
export type MaterialKindKey = (typeof MATERIAL_KINDS)[number];

export const KIND_META: Record<MaterialKindKey, { label: string; plural: string; badge: "indigo" | "amber" | "red" | "green" | "slate"; tile: "indigo" | "amber" | "rose" | "emerald" | "slate" }> = {
  NOTES: { label: "Notes", plural: "Notes", badge: "indigo", tile: "indigo" },
  ASSIGNMENT: { label: "Assignment", plural: "Assignments", badge: "amber", tile: "amber" },
  TEST_PAPER: { label: "Test paper", plural: "Test papers", badge: "red", tile: "rose" },
  SYLLABUS: { label: "Syllabus", plural: "Syllabus", badge: "green", tile: "emerald" },
  OTHER: { label: "Other", plural: "Other", badge: "slate", tile: "slate" },
};

/** Where an uploader may post: a class, its sections, and the subjects allowed in each (null = any of the class's subjects). */
export type MaterialTarget = {
  classId: string;
  className: string;
  /** Whole class allowed (admins); teachers post to one section at a time. */
  wholeClass: boolean;
  sections: { id: string; name: string; subjects: { id: string; name: string }[] }[];
  subjects: { id: string; name: string }[];
};

export const MAX_MATERIAL_LABEL = "4 MB";
