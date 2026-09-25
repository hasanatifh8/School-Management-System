import ExcelJS from "exceljs";
import { getActor } from "@/lib/access";
import { attendanceWindow, loadRegister, pickMonth } from "@/lib/attendance";
import { ATTENDANCE_STATUSES, STATUS_META, formatISO, isSunday, monthName } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/queries";

const FILLS = {
  holiday: "FFEDE9FE",
  sunday: "FFF1F5F9",
  absent: "FFFFE4E6",
  header: "FF4F46E5",
};

/**
 * GET /api/attendance/register?section=…&month=2026-09 — a class's monthly
 * attendance register as Excel. Admins: any class; teachers: their own class.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sectionId = url.searchParams.get("section") ?? "";
  const actor = await getActor();
  const school = actor.kind === "staff" ? actor.school : actor.ctx.school;
  if (actor.kind === "teacher" && actor.ctx.classSection?.id !== sectionId) return new Response("Not found", { status: 404 });
  const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId: school.id } }, include: { class: true } });
  if (!section) return new Response("Not found", { status: 404 });

  const win = await attendanceWindow(school.id);
  const month = pickMonth(url.searchParams.get("month") ?? undefined, win);
  const reg = await loadRegister(school.id, section.id, month, win);

  const wb = new ExcelJS.Workbook();
  wb.creator = school.name;
  const ws = wb.addWorksheet("Register", { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
  const title = `${school.name} · ${sectionLabel(section)} · Attendance ${formatISO(`${month}-01`, monthName)}`;
  ws.addRow([title]).font = { bold: true, size: 13 };
  ws.addRow([`Working days: ${reg.workingDays} · Session ${win.session.name} · P Present, A Absent, L Late, HD Half day, LV Leave`]).font = {
    color: { argb: "FF64748B" },
    size: 10,
  };

  const statusCols = ATTENDANCE_STATUSES.map((s) => STATUS_META[s].short);
  const header = ws.addRow(["Roll", "Student", ...reg.dates.map((d) => Number(d.slice(8))), ...statusCols, "Month %", "Session %"]);
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLS.header } };
    c.alignment = { horizontal: "center" };
  });

  const firstDayCol = 3;
  for (const s of reg.students) {
    const row = ws.addRow([
      s.rollNumber ?? "",
      s.moved ? `${s.name} (left class)` : s.name,
      ...reg.dates.map((d) => {
        if (reg.schoolHolidays.has(d) || reg.classHolidays.has(d)) return "H";
        const st = s.marks.get(d);
        return st ? STATUS_META[st].short : "";
      }),
      ...ATTENDANCE_STATUSES.map((st) => s.month[st]),
      s.monthPercent == null ? "" : s.monthPercent / 100,
      s.sessionPercent == null ? "" : s.sessionPercent / 100,
    ]);
    reg.dates.forEach((d, i) => {
      const cell = row.getCell(firstDayCol + i);
      cell.alignment = { horizontal: "center" };
      const fill = reg.schoolHolidays.has(d) || reg.classHolidays.has(d) ? FILLS.holiday : cell.value === "A" ? FILLS.absent : isSunday(d) ? FILLS.sunday : null;
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });
    const pctStart = firstDayCol + reg.dates.length + statusCols.length;
    row.getCell(pctStart).numFmt = "0.0%";
    row.getCell(pctStart + 1).numFmt = "0.0%";
  }

  const holidays = [...reg.schoolHolidays].map(([d, h]) => `${Number(d.slice(8))}: ${h.name}`).concat([...reg.classHolidays].map(([d, r]) => `${Number(d.slice(8))}: ${r} (class)`));
  if (holidays.length) {
    ws.addRow([]);
    ws.addRow(["", `Holidays — ${holidays.join(" · ")}`]).font = { color: { argb: "FF6D28D9" }, size: 10 };
  }

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  reg.dates.forEach((_, i) => (ws.getColumn(firstDayCol + i).width = 4));
  statusCols.forEach((_, i) => (ws.getColumn(firstDayCol + reg.dates.length + i).width = 5));
  ws.getColumn(firstDayCol + reg.dates.length + statusCols.length).width = 10;
  ws.getColumn(firstDayCol + reg.dates.length + statusCols.length + 1).width = 10;

  const file = Buffer.from(await wb.xlsx.writeBuffer());
  const name = `attendance-${section.class.name}-${section.name}-${month}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
