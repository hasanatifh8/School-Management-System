// Turning spreadsheet cells into form values, and results shown on the upload page.
import type { z } from "zod";
import { IMPORT_COLUMNS, type ImportKind } from "@/lib/import/columns";

export type ImportRowResult = {
  rowNumber: number;
  name: string;
  detail: string;
  errors: string[];
  warnings: string[];
};

export type ImportState = {
  error?: string;
  preview?: { fileName: string; rows: ImportRowResult[]; valid: number; invalid: number };
  done?: { created: number; skipped: number; codes: string[] };
};

/** "15-08-2015", "15/08/2015", "2015-08-15" → "2015-08-15". "" stays "", anything else → null. */
export function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!dmy && !ymd) return null;
  const [y, mo, d] = dmy ? [+dmy[3], +dmy[2], +dmy[1]] : [+ymd![1], +ymd![2], +ymd![3]];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export function toGender(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (["male", "m", "boy"].includes(s)) return "MALE";
  if (["female", "f", "girl"].includes(s)) return "FEMALE";
  if (["other", "o"].includes(s)) return "OTHER";
  return null;
}

/** "B+", "b +ve", "B positive", "AB−" → "B_POS" / "AB_NEG". */
export function toBloodGroup(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "").replace(/[−–]/g, "-");
  if (!s) return "";
  const m = s.match(/^(AB|A|B|O)(\+|-|\+VE|-VE|POS|NEG|POSITIVE|NEGATIVE)$/);
  if (!m) return null;
  return `${m[1]}_${m[2].startsWith("+") || m[2].startsWith("POS") ? "POS" : "NEG"}`;
}

/** Zod field errors as "Column: message" lines, using the template's column names. */
export function describeErrors(kind: ImportKind, error: z.ZodError, fieldToColumn: Record<string, string> = {}) {
  const labels = new Map(IMPORT_COLUMNS[kind].map((c) => [c.key, c.header]));
  const out: string[] = [];
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    const column = labels.get(fieldToColumn[field] ?? field) ?? field;
    const prefixed = !column || issue.message.toLowerCase().startsWith(column.toLowerCase());
    out.push(prefixed ? issue.message : `${column}: ${issue.message}`);
  }
  return out;
}
