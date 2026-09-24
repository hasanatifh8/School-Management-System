import "server-only";
import ExcelJS from "exceljs";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, type ImportKind } from "@/lib/import/columns";

const SHEET_NAMES: Record<ImportKind, string> = { students: "Students", teachers: "Teachers" };
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const TEXT_COLUMNS = new Set(["phone", "aadhaarNumber", "rollNumber", "sectionName"]);
const DATE_COLUMNS = new Set(["dateOfBirth", "admissionDate", "joiningDate"]);

/* ───────────────────────── Template ───────────────────────── */

/** Builds the downloadable .xlsx template: a data sheet with dropdowns plus an instructions sheet. */
export async function buildTemplate(kind: ImportKind, classNames: string[]) {
  const columns = IMPORT_COLUMNS[kind];
  const wb = new ExcelJS.Workbook();
  wb.creator = "School Management System";

  const sheet = wb.addWorksheet(SHEET_NAMES[kind], { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    key: c.key,
    width: c.width ?? 14,
    style: TEXT_COLUMNS.has(c.key) ? { numFmt: "@" } : DATE_COLUMNS.has(c.key) ? { numFmt: "dd-mm-yyyy" } : {},
  }));
  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell, i) => {
    const col = columns[i - 1];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.required ? "FF4F46E5" : "FF64748B" } };
    cell.alignment = { vertical: "middle" };
    if (col.note) cell.note = col.note;
  });

  // Dropdown sources live on a hidden sheet so long class lists still work.
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });
  lists.getCell("A1").value = "Classes";
  classNames.forEach((name, i) => (lists.getCell(`A${i + 2}`).value = name));

  const lastRow = MAX_IMPORT_ROWS + 1;
  columns.forEach((c, i) => {
    if (!c.list) return;
    const letter = sheet.getColumn(i + 1).letter;
    const formula =
      c.list === "classes"
        ? classNames.length
          ? `Lists!$A$2:$A$${classNames.length + 1}`
          : null
        : `"${c.list.join(",")}"`;
    if (!formula) return;
    for (let r = 2; r <= lastRow; r++) {
      sheet.getCell(`${letter}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: c.header,
        error: `Choose a value from the list for ${c.header}.`,
      };
    }
  });

  const help = wb.addWorksheet("Instructions");
  help.columns = [
    { header: "Column", key: "column", width: 20 },
    { header: "Required", key: "required", width: 10 },
    { header: "Example", key: "example", width: 26 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  help.getRow(1).font = { bold: true };
  for (const c of columns) {
    help.addRow({
      column: c.header,
      required: c.required ? "Yes" : "",
      example: c.list === "classes" ? classNames[0] ?? "Class 1" : c.example,
      notes: [c.note, c.list && "Pick from the dropdown"].filter(Boolean).join(". "),
    });
  }
  help.addRow({});
  help.addRow({ column: `Fill one ${kind === "students" ? "student" : "teacher"} per row on the "${SHEET_NAMES[kind]}" sheet, starting at row 2.` });
  help.addRow({ column: `Up to ${MAX_IMPORT_ROWS} rows per file. IDs are generated automatically.` });
  help.addRow({ column: "Other details (photo, address, documents…) can be added later on each profile." });

  // Put the data sheet first so it opens by default.
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ───────────────────────── Reading ───────────────────────── */

export type SheetRow = { rowNumber: number; values: Record<string, string> };

const normalizeHeader = (s: string) => s.replace(/\*/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

function toDateString(d: Date) {
  // Excel dates arrive as UTC midnight.
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return toDateString(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === "string" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((t) => t.text).join("").trim();
    if ("text" in value) return cellText(value.text as ExcelJS.CellValue);
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return "";
}

/**
 * Reads the uploaded .xlsx into rows keyed by column key. Columns are matched
 * by header text, so their order doesn't matter and extra columns are ignored.
 */
export async function readImportFile(
  kind: ImportKind,
  file: FormDataEntryValue | null,
): Promise<{ rows: SheetRow[] } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the filled-in Excel file." };
  if (file.size > MAX_FILE_BYTES) return { error: "The file is larger than 4 MB." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Upload an Excel .xlsx file (use the template)." };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "This file couldn't be read as an Excel workbook." };
  }
  const sheet =
    wb.getWorksheet(SHEET_NAMES[kind]) ?? wb.worksheets.find((w) => !["Lists", "Instructions"].includes(w.name));
  if (!sheet) return { error: "The workbook has no data sheet." };

  const columns = IMPORT_COLUMNS[kind];
  const byHeader = new Map(columns.flatMap((c) => [[normalizeHeader(c.header), c.key], [normalizeHeader(c.key), c.key]]));
  const keyAt = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, col) => {
    const key = byHeader.get(normalizeHeader(cellText(cell.value)));
    if (key) keyAt.set(col, key);
  });
  const found = new Set(keyAt.values());
  const missing = columns.filter((c) => c.required && !found.has(c.key)).map((c) => c.header);
  if (missing.length) {
    return { error: `Column${missing.length > 1 ? "s" : ""} ${missing.map((m) => `“${m}”`).join(", ")} not found. Please use the template.` };
  }

  const rows: SheetRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: Record<string, string> = {};
    for (const [col, key] of keyAt) values[key] = cellText(row.getCell(col).value);
    if (Object.values(values).every((v) => !v)) continue; // skip empty rows
    rows.push({ rowNumber: r, values });
  }
  if (!rows.length) return { error: "No rows found. Fill in the sheet starting at row 2." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `The file has ${rows.length} rows; upload at most ${MAX_IMPORT_ROWS} at a time.` };
  }
  return { rows };
}
