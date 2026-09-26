import ExcelJS from "exceljs";
import { getActor } from "@/lib/access";
import {
  attendanceWindow,
  filterRegisterStudents,
  loadClassSummaries,
  loadRegister,
  pickRange,
  type ClassSummary,
  type Register,
  type RegisterRange,
} from "@/lib/attendance";
import { ATTENDANCE_STATUSES, MAX_DAILY_DAYS, STATUS_META, isSunday, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/queries";

const FILLS = {
  holiday: "FFEDE9FE",
  sunday: "FFF1F5F9",
  absent: "FFFFE4E6",
  header: "FF5B4EE8",
};
const TEXT = { good: "FF047857", warn: "FFB45309", bad: "FFBE123C", muted: "FF64748B" };
const PERIOD_LABEL = { week: "Week", month: "Month", year: "Session", custom: "Range" } as const;
const monthShort = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

/**
 * GET /api/attendance/register?section=…&period=week|month|year|custom&…
 * A class's attendance register as Excel, for the same range and student
 * filters (?q=, ?band=) as the screen. Admins: any class; teachers: their own
 * class. section=all (admins only, optional ?classId=) exports one row per class.
 * Sheets: "Day by day" (one column per date) and "Summary" (totals and a
 * percentage per month); the summary comes first for long ranges.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sectionId = url.searchParams.get("section") ?? "";
  const actor = await getActor();
  const school = actor.kind === "staff" ? actor.school : actor.ctx.school;
  const params = Object.fromEntries(url.searchParams);

  // Every class, one row each (admins only).
  if (sectionId === "all") {
    if (actor.kind !== "staff") return new Response("Not found", { status: 404 });
    const win = await attendanceWindow(school.id);
    const range = pickRange(params, win);
    const classId = url.searchParams.get("classId");
    const rows = (await loadClassSummaries(school.id, range.from, range.to)).filter((c) => !classId || c.classId === classId);
    const wb = new ExcelJS.Workbook();
    wb.creator = school.name;
    classesSheet(wb, rows, `${school.name} · Class-wise attendance ${range.label}`, `Session ${win.session.name} · Average is the mean of each student's percentage`);
    const span = range.period === "month" ? range.from.slice(0, 7) : range.period === "week" ? `week-${range.from}` : `${range.from}-to-${range.to}`;
    return xlsx(wb, `attendance-all-classes-${span}`);
  }

  if (actor.kind === "teacher" && actor.ctx.classSection?.id !== sectionId) return new Response("Not found", { status: 404 });
  const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId: school.id } }, include: { class: true } });
  if (!section) return new Response("Not found", { status: 404 });

  const win = await attendanceWindow(school.id);
  const range = pickRange(params, win);
  const full = await loadRegister(school.id, section.id, range.from, range.to, win);
  // Same student filters as the screen (?q=, ?band=).
  const reg = { ...full, students: filterRegisterStudents(full.students, params) };

  const wb = new ExcelJS.Workbook();
  wb.creator = school.name;
  const title = `${school.name} · ${sectionLabel(section)} · Attendance ${range.label}`;
  const note = `Working days: ${reg.workingDays} · Session ${win.session.name} · P Present, A Absent, L Late, HD Half day, LV Leave, H Holiday`;
  const long = reg.dates.length > MAX_DAILY_DAYS;
  if (long) {
    summarySheet(wb, reg, range, title, note);
    dailySheet(wb, reg, range, title, note);
  } else {
    dailySheet(wb, reg, range, title, note);
    summarySheet(wb, reg, range, title, note);
  }

  const span =
    range.period === "month" ? range.from.slice(0, 7) : range.period === "week" ? `week-${range.from}` : `${range.from}-to-${range.to}`;
  return xlsx(wb, `attendance-${section.class.name}-${section.name}-${span}`);
}

async function xlsx(wb: ExcelJS.Workbook, baseName: string) {
  const file = Buffer.from(await wb.xlsx.writeBuffer());
  const name = baseName.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

function titleRows(ws: ExcelJS.Worksheet, title: string, note: string) {
  ws.addRow([title]).font = { bold: true, size: 13 };
  ws.addRow([note]).font = { color: { argb: TEXT.muted }, size: 10 };
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLS.header } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
}

/** Percentage cell (stored as a fraction) coloured green / amber / red. */
function percentCell(cell: ExcelJS.Cell, p: number | null) {
  cell.value = p == null ? "" : p / 100;
  cell.numFmt = "0.0%";
  cell.alignment = { horizontal: "center" };
  if (p != null) cell.font = { color: { argb: p >= 90 ? TEXT.good : p >= 75 ? TEXT.warn : TEXT.bad }, bold: true };
}

function dailySheet(wb: ExcelJS.Workbook, reg: Register, range: RegisterRange, title: string, note: string) {
  const ws = wb.addWorksheet("Day by day", { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
  titleRows(ws, title, note);
  const oneMonth = reg.months.length === 1;
  const statusCols = ATTENDANCE_STATUSES.map((s) => STATUS_META[s].short);
  const header = ws.addRow([
    "Roll",
    "Student",
    ...reg.dates.map((d) => (oneMonth ? Number(d.slice(8)) : `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`)),
    ...statusCols,
    `${PERIOD_LABEL[range.period]} %`,
    "Session %",
  ]);
  styleHeader(header);

  const firstDayCol = 3;
  const pctCol = firstDayCol + reg.dates.length + statusCols.length;
  for (const s of reg.students) {
    const row = ws.addRow([
      s.rollNumber ?? "",
      s.moved ? `${s.name} (left class)` : s.name,
      ...reg.dates.map((d) => {
        if (reg.schoolHolidays.has(d) || reg.classHolidays.has(d)) return "H";
        const st = s.marks.get(d);
        return st ? STATUS_META[st].short : "";
      }),
      ...ATTENDANCE_STATUSES.map((st) => s.period[st]),
    ]);
    reg.dates.forEach((d, i) => {
      const cell = row.getCell(firstDayCol + i);
      cell.alignment = { horizontal: "center" };
      const fill = reg.schoolHolidays.has(d) || reg.classHolidays.has(d) ? FILLS.holiday : cell.value === "A" ? FILLS.absent : isSunday(d) ? FILLS.sunday : null;
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });
    percentCell(row.getCell(pctCol), s.periodPercent);
    percentCell(row.getCell(pctCol + 1), s.sessionPercent);
  }
  // Attending count per day.
  const totals = ws.addRow(["", "Attending", ...reg.dates.map((d) => reg.daily.get(d) ?? "")]);
  totals.font = { bold: true, color: { argb: TEXT.muted } };
  reg.dates.forEach((_, i) => (totals.getCell(firstDayCol + i).alignment = { horizontal: "center" }));

  const holidays = [...reg.schoolHolidays]
    .map(([d, h]) => `${d.slice(8)}/${d.slice(5, 7)}: ${h.name}`)
    .concat([...reg.classHolidays].map(([d, r]) => `${d.slice(8)}/${d.slice(5, 7)}: ${r} (class)`));
  if (holidays.length) {
    ws.addRow([]);
    ws.addRow(["", `Holidays — ${holidays.join(" · ")}`]).font = { color: { argb: "FF6D28D9" }, size: 10 };
  }

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  reg.dates.forEach((_, i) => (ws.getColumn(firstDayCol + i).width = oneMonth ? 4 : 6));
  statusCols.forEach((_, i) => (ws.getColumn(firstDayCol + reg.dates.length + i).width = 5));
  ws.getColumn(pctCol).width = 11;
  ws.getColumn(pctCol + 1).width = 11;
}

function summarySheet(wb: ExcelJS.Workbook, reg: Register, range: RegisterRange, title: string, note: string) {
  const ws = wb.addWorksheet("Summary", { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
  titleRows(ws, title, note);
  const showMonths = reg.months.length > 1;
  const statusCols = ATTENDANCE_STATUSES.map((s) => STATUS_META[s].label);
  const monthCols = showMonths ? reg.months.map((m) => `${monthShort.format(parseISODate(`${m}-01`)!)} %`) : [];
  styleHeader(ws.addRow(["Roll", "Student", "Days marked", ...statusCols, ...monthCols, `${PERIOD_LABEL[range.period]} %`, "Session %"]));

  const firstStatus = 4;
  const firstMonth = firstStatus + statusCols.length;
  const pctCol = firstMonth + monthCols.length;
  for (const s of reg.students) {
    const marked = ATTENDANCE_STATUSES.reduce((n, st) => n + s.period[st], 0);
    const row = ws.addRow([s.rollNumber ?? "", s.moved ? `${s.name} (left class)` : s.name, marked, ...ATTENDANCE_STATUSES.map((st) => s.period[st])]);
    for (let c = 3; c < firstMonth; c++) row.getCell(c).alignment = { horizontal: "center" };
    if (s.period.ABSENT) row.getCell(firstStatus + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLS.absent } };
    if (showMonths) reg.months.forEach((m, i) => percentCell(row.getCell(firstMonth + i), s.monthPercent.get(m) ?? null));
    percentCell(row.getCell(pctCol), s.periodPercent);
    percentCell(row.getCell(pctCol + 1), s.sessionPercent);
  }
  if (showMonths) {
    ws.addRow([]);
    ws.addRow(["", `Working days per month — ${reg.months.map((m) => `${monthShort.format(parseISODate(`${m}-01`)!)}: ${reg.workingByMonth.get(m) ?? 0}`).join(" · ")}`]).font = {
      color: { argb: TEXT.muted },
      size: 10,
    };
  }

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 12;
  statusCols.forEach((_, i) => (ws.getColumn(firstStatus + i).width = 10));
  monthCols.forEach((_, i) => (ws.getColumn(firstMonth + i).width = 10));
  ws.getColumn(pctCol).width = 12;
  ws.getColumn(pctCol + 1).width = 12;
}

function classesSheet(wb: ExcelJS.Workbook, rows: ClassSummary[], title: string, note: string) {
  const ws = wb.addWorksheet("Classes", { views: [{ state: "frozen", xSplit: 1, ySplit: 3 }] });
  titleRows(ws, title, note);
  styleHeader(ws.addRow(["Class", "Class teacher", "Students", "Working days", "Average %", "Below 75%", "Absences"]));
  for (const c of rows) {
    const row = ws.addRow([c.label, c.classTeacher ?? "", c.students, c.workingDays, null, c.below75, c.absences]);
    for (const col of [3, 4, 6, 7]) row.getCell(col).alignment = { horizontal: "center" };
    percentCell(row.getCell(5), c.average);
    if (c.below75) row.getCell(6).font = { color: { argb: TEXT.bad }, bold: true };
  }
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 26;
  for (const col of [3, 4, 5, 6, 7]) ws.getColumn(col).width = 13;
}
