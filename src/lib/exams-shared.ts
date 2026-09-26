// Exams & tests: types and helpers shared by the server and the timetable
// editor / print view. No server-only imports.

/** One row of the date sheet as the editor sends it. */
export type PaperInput = {
  /** Saved paper's id ("" for a new row), so edits keep its marks. */
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  classId: string; // "" = every class in the exam
  subjectId: string; // "" = use the title only
  title: string;
  maxMarks: string;
  room: string;
  notes: string;
};

export const MAX_PAPERS = 200;

export const emptyPaper = (): PaperInput => ({
  id: "",
  date: "",
  startTime: "09:00",
  endTime: "12:00",
  classId: "",
  subjectId: "",
  title: "",
  maxMarks: "",
  room: "",
  notes: "",
});

/* ───────────────────────── Print settings ───────────────────────── */

export type PrintLayout = "class" | "grid";

export type PrintSettings = {
  /** "class": a date sheet per class. "grid": one chart, dates down and classes across. */
  layout: PrintLayout;
  orientation: "portrait" | "landscape";
  /** Heading; blank = the exam name. */
  title: string;
  subtitle: string;
  showDay: boolean;
  showTime: boolean;
  showMarks: boolean;
  showRoom: boolean;
  showNotes: boolean;
  showInstructions: boolean;
  showLogo: boolean;
  /** "class" layout: start each class on a new page. */
  pagePerClass: boolean;
  fontSize: "small" | "normal" | "large";
  /** Signature lines at the bottom, e.g. "Class teacher, Principal". */
  signatures: string;
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  layout: "class",
  orientation: "portrait",
  title: "",
  subtitle: "",
  showDay: true,
  showTime: true,
  showMarks: true,
  showRoom: false,
  showNotes: true,
  showInstructions: true,
  showLogo: true,
  pagePerClass: true,
  fontSize: "normal",
  signatures: "Class teacher, Principal",
};

/** Saved settings merged over the defaults, ignoring anything unexpected. */
export function readPrintSettings(raw: unknown): PrintSettings {
  const s = { ...DEFAULT_PRINT_SETTINGS };
  if (!raw || typeof raw !== "object") return s;
  const r = raw as Record<string, unknown>;
  if (r.layout === "class" || r.layout === "grid") s.layout = r.layout;
  if (r.orientation === "portrait" || r.orientation === "landscape") s.orientation = r.orientation;
  if (r.fontSize === "small" || r.fontSize === "normal" || r.fontSize === "large") s.fontSize = r.fontSize;
  for (const key of ["title", "subtitle", "signatures"] as const) {
    if (typeof r[key] === "string") s[key] = (r[key] as string).slice(0, 200);
  }
  for (const key of ["showDay", "showTime", "showMarks", "showRoom", "showNotes", "showInstructions", "showLogo", "pagePerClass"] as const) {
    if (typeof r[key] === "boolean") s[key] = r[key] as boolean;
  }
  return s;
}

/* ───────────────────────── Formatting ───────────────────────── */

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "13:30" → "1:30 PM" */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const timeRange = (start: string, end: string) => `${formatTime(start)} – ${formatTime(end)}`;

const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" });
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const formatDay = (iso: string) => dayFmt.format(utc(iso));
export const formatExamDate = (iso: string) => dateFmt.format(utc(iso));
export const formatShortDate = (iso: string) => shortDateFmt.format(utc(iso));

/** "12 Oct – 20 Oct 2026", or one date. */
export function dateSpan(dates: string[]) {
  if (!dates.length) return "No dates yet";
  const sorted = [...dates].sort();
  const [first, last] = [sorted[0], sorted[sorted.length - 1]];
  return first === last ? formatExamDate(first) : `${formatShortDate(first)} – ${formatExamDate(last)}`;
}

/** A timetable row ready to show or print. */
export type PaperView = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  classId: string | null;
  subject: string; // subject name and/or title
  maxMarks: number | null;
  room: string | null;
  notes: string | null;
};

/** "Mathematics", "Mathematics (Practical)" or "Drawing". */
export function paperName(subjectName: string | null | undefined, title: string | null | undefined) {
  if (subjectName && title) return `${subjectName} (${title})`;
  return subjectName || title || "—";
}

/* ───────────────────────── Marks & results ───────────────────────── */

/** Minimum percentage to pass a paper. */
export const PASS_PERCENT = 33;

/** CBSE-style 8-point grades by percentage. */
export const GRADES = [
  { min: 91, grade: "A1" },
  { min: 81, grade: "A2" },
  { min: 71, grade: "B1" },
  { min: 61, grade: "B2" },
  { min: 51, grade: "C1" },
  { min: 41, grade: "C2" },
  { min: 33, grade: "D" },
  { min: 0, grade: "E" },
] as const;

export const gradeFor = (percent: number) => GRADES.find((g) => percent >= g.min)!.grade;

/** A typed mark: blank (not entered), "AB" (absent) or a number from 0 to max with up to 2 decimals. */
export function parseMark(text: string, max: number): { empty: true } | { absent: true } | { marks: number } | { error: string } {
  const t = text.trim().toUpperCase();
  if (!t) return { empty: true };
  if (t === "AB" || t === "A" || t === "ABS" || t === "ABSENT") return { absent: true };
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return { error: "Enter marks, or AB for absent" };
  const n = Number(t);
  if (n > max) return { error: `Max ${max}` };
  return { marks: n };
}

/** 32.5 → "32.5", 40 → "40" */
export const formatMarks = (n: number) => String(Math.round(n * 100) / 100);
