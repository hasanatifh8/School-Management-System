import "server-only";
// PDF files for fee receipts and student fee ledgers (A4), built with pdf-lib.
// Noto Sans is embedded (subset) because the standard PDF fonts have no ₹ sign.
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import { MODE_LABELS, amountInWords, rupees } from "@/lib/fees-shared";
import { earlierPayments, type Ledger } from "@/lib/fees";
import { fullName, sectionLabel } from "@/lib/queries";

const A4 = { w: 595.28, h: 841.89 };
const M = 40; // page margin
const INK = rgb(0.06, 0.07, 0.08);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.84, 0.86, 0.89);
const ACCENT = rgb(0.357, 0.306, 0.91); // #5b4ee8
const FILL = rgb(0.96, 0.965, 0.975);
const RED = rgb(0.75, 0.07, 0.24);

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

let fonts: Promise<[Buffer, Buffer]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all(["Regular", "Bold"].map((w) => readFile(path.join(process.cwd(), "src/assets/fonts", `NotoSans-${w}.ttf`)))) as Promise<[Buffer, Buffer]>);

type School = { id: string; name: string; address: string | null; phone: string | null; email: string | null };

/** A document with a cursor: text, rows and automatic page breaks. */
class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly header: (w: Writer) => void,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - M;
    this.header(this);
  }

  /** Starts a new page if fewer than `h` points are left. */
  ensure(h: number) {
    if (this.y - h < M + 20) this.newPage();
  }

  text(t: string, x: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center"; width?: number } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.bold : this.regular;
    let s = t;
    // Shorten text that doesn't fit its column.
    if (opts.width) while (s.length > 1 && font.widthOfTextAtSize(s, size) > opts.width) s = `${s.slice(0, -2)}…`;
    const tw = font.widthOfTextAtSize(s, size);
    const dx = opts.align === "right" ? (opts.width ?? 0) - tw : opts.align === "center" ? ((opts.width ?? 0) - tw) / 2 : 0;
    this.page.drawText(s, { x: x + dx, y: this.y, size, font, color: opts.color ?? INK });
  }

  line(x1: number, x2: number, color = LINE, thickness = 0.6) {
    this.page.drawLine({ start: { x: x1, y: this.y }, end: { x: x2, y: this.y }, color, thickness });
  }

  /**
   * A table with a header row repeated on each page. Each column has a width
   * (points) and alignment; cells may hold several lines (string[]).
   */
  table(cols: { label: string; w: number; align?: "left" | "right" }[], rows: { cells: (string | string[])[]; muted?: boolean; bold?: boolean }[], foot?: (string | string[])[]) {
    const x0 = M;
    const width = cols.reduce((n, c) => n + c.w, 0);
    const head = () => {
      this.ensure(22);
      this.page.drawRectangle({ x: x0, y: this.y - 6, width, height: 18, color: FILL });
      let x = x0;
      for (const c of cols) {
        this.text(c.label.toUpperCase(), x + 4, { size: 6.8, bold: true, color: MUTED, align: c.align, width: c.w - 8 });
        x += c.w;
      }
      this.y -= 18;
    };
    head();
    const drawRow = (cells: (string | string[])[], opts: { muted?: boolean; bold?: boolean } = {}) => {
      const lines = Math.max(...cells.map((c) => (Array.isArray(c) ? Math.max(c.length, 1) : 1)));
      const h = 12 * lines + 4;
      if (this.y - h < M + 20) {
        this.newPage();
        head();
      }
      let x = x0;
      cols.forEach((c, i) => {
        const cell = cells[i] ?? "";
        const parts = Array.isArray(cell) ? cell : [cell];
        parts.forEach((p, j) => {
          const saved = this.y;
          this.y -= j * 12;
          this.text(p, x + 4, { size: j ? 7.5 : 8.5, bold: opts.bold && !j, color: opts.muted || j ? MUTED : INK, align: c.align, width: c.w - 8 });
          this.y = saved;
        });
        x += c.w;
      });
      this.y -= h - 8;
      this.line(x0, x0 + width);
      this.y -= 12;
    };
    for (const r of rows) drawRow(r.cells, r);
    if (foot) drawRow(foot, { bold: true });
  }
}

async function newDoc(title: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [reg, bold] = await loadFonts();
  doc.setTitle(title);
  doc.setProducer("Scholdesk");
  return { doc, regular: await doc.embedFont(reg, { subset: true }), bold: await doc.embedFont(bold, { subset: true }) };
}

async function schoolLogo(doc: PDFDocument, schoolId: string): Promise<PDFImage | null> {
  const logo = await db.schoolLogo.findUnique({ where: { schoolId } });
  if (!logo) return null;
  try {
    if (logo.mimeType === "image/png") return await doc.embedPng(logo.data);
    if (logo.mimeType === "image/jpeg") return await doc.embedJpg(logo.data);
  } catch {}
  return null; // other formats (e.g. WebP) are left out
}

/** School name, address and logo across the top, with a title tag on the right. */
function letterhead(school: School, logo: PDFImage | null, tag: string) {
  return (w: Writer) => {
    const top = w.y;
    let x = M;
    if (logo) {
      const s = 44 / Math.max(logo.width, logo.height);
      w.page.drawImage(logo, { x: M, y: top - 40, width: logo.width * s, height: logo.height * s });
      x = M + 54;
    }
    w.y = top - 12;
    w.text(school.name.toUpperCase(), x, { size: 13, bold: true, width: 330 });
    w.y -= 13;
    if (school.address) w.text(school.address.replace(/\n/g, ", "), x, { size: 7.5, color: MUTED, width: 330 });
    w.y -= 10;
    const contact = [school.phone, school.email].filter(Boolean).join(" · ");
    if (contact) w.text(contact, x, { size: 7.5, color: MUTED, width: 330 });
    // Title tag
    const tw = w.bold.widthOfTextAtSize(tag.toUpperCase(), 8) + 14;
    w.page.drawRectangle({ x: A4.w - M - tw, y: top - 16, width: tw, height: 16, color: ACCENT });
    w.y = top - 11;
    w.text(tag.toUpperCase(), A4.w - M - tw, { size: 8, bold: true, color: rgb(1, 1, 1), align: "center", width: tw });
    w.y = top - 52;
    w.line(M, A4.w - M, LINE, 1);
    w.y -= 18;
  };
}

/** Label/value pairs in two columns. */
function details(w: Writer, pairs: [string, string][]) {
  const colW = (A4.w - 2 * M) / 2;
  for (let i = 0; i < pairs.length; i += 2) {
    w.ensure(14);
    pairs.slice(i, i + 2).forEach(([k, v], j) => {
      const x = M + j * colW;
      w.text(k, x, { size: 8, color: MUTED });
      w.text(v || "—", x + 72, { size: 9, bold: true, width: colW - 80 });
    });
    w.y -= 14;
  }
}

function footer(w: Writer, note: string) {
  const pages = w.doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${note} · Page ${i + 1} of ${pages.length}`, { x: M, y: M - 16, size: 7, font: w.regular, color: MUTED });
  });
}

/* ───────────────────────── Receipt ───────────────────────── */

export async function receiptPdf(schoolId: string, receiptId: string) {
  const receipt = await db.feeReceipt.findFirst({
    where: { id: receiptId, schoolId },
    include: { items: { orderBy: { id: "asc" } }, session: { select: { name: true } }, student: { select: { fatherName: true, rollNumber: true } }, school: true },
  });
  if (!receipt) return null;
  const { doc, regular, bold } = await newDoc(`Fee receipt ${receipt.number}`);
  const logo = await schoolLogo(doc, schoolId);
  const w = new Writer(doc, regular, bold, letterhead(receipt.school, logo, "Fee receipt"));

  details(w, [
    ["Receipt no.", receipt.number],
    ["Date", fmtDate(receipt.date.toISOString().slice(0, 10))],
    ["Student", receipt.studentName],
    ["Student ID", receipt.studentCode],
    ["Class", `${receipt.className ?? "—"}${receipt.student?.rollNumber != null ? ` · Roll ${receipt.student.rollNumber}` : ""}`],
    ["Father", receipt.student?.fatherName ?? "—"],
  ]);
  w.y -= 6;

  const discount = receipt.items.reduce((n, i) => n + i.discount, 0);
  const lateFee = receipt.items.reduce((n, i) => n + i.lateFee, 0);
  const lateCount = receipt.items.filter((i) => i.lateFee > 0).length;
  const cols = [
    { label: "#", w: 26 },
    { label: "Fee", w: 235 },
    { label: "Period", w: 150 },
    { label: "Amount", w: 94, align: "right" as const },
  ];
  w.table(
    cols,
    [
      // Each fee at its full amount; the discount comes off the total, once.
      ...receipt.items.map((i, n) => ({
        cells: [String(n + 1), i.headName, i.charged > 0 && i.amount + i.discount < i.charged ? `${i.periodLabel} (part of ${rupees(i.charged)})` : i.periodLabel, rupees(i.amount + i.discount)],
      })),
      // Late fees collected, as one line (the total already includes them).
      ...(lateFee ? [{ cells: [String(receipt.items.length + 1), "Late fee", `${lateCount} late instalment${lateCount === 1 ? "" : "s"}`, rupees(lateFee)] }] : []),
      ...(discount
        ? [
            { cells: ["", "Subtotal", "", rupees(receipt.total + discount)] },
            { cells: ["", "Discount", "", `- ${rupees(discount)}`] },
          ]
        : []),
    ],
    ["", discount ? "Total paid" : "Total", "", rupees(receipt.total)],
  );
  w.ensure(80);
  w.text(amountInWords(receipt.total), M, { size: 8.5, color: MUTED, width: A4.w - 2 * M });
  w.y -= 22;
  const earlier = await earlierPayments(receipt);
  if (earlier.count) {
    w.text(
      `Paid earlier this session: ${rupees(earlier.total)} (${earlier.count} receipt${earlier.count === 1 ? "" : "s"}) · Total paid so far: ${rupees(earlier.total + (receipt.cancelledAt ? 0 : receipt.total))}`,
      M,
      { size: 8.5, width: A4.w - 2 * M },
    );
    w.y -= 13;
  }
  if (receipt.feeNote) {
    w.text(receipt.feeNote, M, { size: 8.5, color: MUTED, width: A4.w - 2 * M });
    w.y -= 13;
  }
  w.y -= 4;

  const notes: [string, string][] = [["Paid by", receipt.total ? `${MODE_LABELS[receipt.mode]}${receipt.reference ? ` · ${receipt.reference}` : ""}` : "Nothing to pay (fully discounted)"]];
  if (receipt.lateWaived) notes.push(["Late fee waived", rupees(receipt.lateWaived)]);
  if (receipt.remarks) notes.push(["Remarks", receipt.remarks]);
  if (discount) notes.push([`Discount ${rupees(discount)}`, receipt.discountNote ?? ""]);
  notes.push(["Received by", receipt.collectedBy]);
  for (const [k, v] of notes) {
    w.text(`${k}:`, M, { size: 8.5, color: MUTED });
    w.text(v, M + 90, { size: 8.5, width: 300 });
    w.y -= 13;
  }
  if (receipt.cancelledAt) {
    w.y -= 4;
    w.text(`CANCELLED by ${receipt.cancelledBy}: ${receipt.cancelReason}`, M, { size: 10, bold: true, color: RED, width: A4.w - 2 * M });
    w.page.drawText("CANCELLED", { x: 150, y: 420, size: 64, font: bold, color: RED, opacity: 0.15, rotate: degrees(20) });
    w.y -= 13;
  }
  w.y -= 30;
  w.line(A4.w - M - 130, A4.w - M, MUTED);
  w.y -= 11;
  w.text("Signature", A4.w - M - 130, { size: 8, color: MUTED, align: "center", width: 130 });

  footer(w, `Computer-generated receipt · Session ${receipt.session.name}`);
  return { bytes: await doc.save(), fileName: `Receipt-${receipt.number.replace(/[^\w-]+/g, "-")}.pdf` };
}

/* ───────────────────────── Ledger ───────────────────────── */

const STATUS_LABEL = { PAID: "Paid", PARTIAL: "Part paid", OVERDUE: "Overdue", DUE: "Due", UPCOMING: "Upcoming", NONE: "—" } as const;
const KIND_TAG: Partial<Record<Ledger["statement"][number]["kind"], string>> = {
  OPENING: "Brought forward",
  LATE: "Late fee",
  LATE_DUE: "Late fee due",
  DISCOUNT: "Discount",
  WAIVER: "Waived",
  CANCELLED: "Cancelled",
};

export async function ledgerPdf(ledger: Ledger, school: School) {
  const { student, session, statement, months, sums } = ledger;
  const name = fullName(student);
  const { doc, regular, bold } = await newDoc(`Fee ledger – ${name}`);
  const logo = await schoolLogo(doc, school.id);
  const w = new Writer(doc, regular, bold, letterhead(school, logo, "Fee ledger"));

  details(w, [
    ["Student", name],
    ["Student ID", student.studentCode],
    ["Class", student.section ? `${sectionLabel(student.section)}${student.rollNumber != null ? ` · Roll ${student.rollNumber}` : ""}` : "—"],
    ["Session", session.name],
    ["Father", student.fatherName ?? "—"],
    ["Printed on", fmtDate(ledger.today)],
  ]);
  w.y -= 4;

  // Summary strip
  const tiles: [string, string, boolean][] = [
    ["Fees charged", rupees(sums.fees + sums.opening), false],
    ["Late fees", rupees(sums.lateCharged + sums.lateDue), false],
    ["Discounts", rupees(sums.discount), false],
    ["Late fee waived", rupees(sums.lateWaived), false],
    ["Paid", rupees(sums.paid), false],
    ["Balance due", rupees(sums.dueNow), sums.dueNow > 0],
  ];
  const tw = (A4.w - 2 * M) / tiles.length;
  w.ensure(44);
  tiles.forEach(([k, v, red], i) => {
    const x = M + i * tw;
    w.page.drawRectangle({ x: x + 2, y: w.y - 26, width: tw - 4, height: 38, color: FILL });
    w.text(k.toUpperCase(), x + 8, { size: 6.4, bold: true, color: MUTED });
    w.y -= 16;
    w.text(v, x + 8, { size: 10.5, bold: true, color: red ? RED : INK, width: tw - 12 });
    w.y += 16;
  });
  w.y -= 44;

  if (months.length) {
    w.text("Month by month", M, { size: 10.5, bold: true });
    w.y -= 14;
    w.table(
      [
        { label: "Month", w: 150 },
        { label: "Fees", w: 62, align: "right" },
        { label: "Late fee", w: 62, align: "right" },
        { label: "Discount", w: 62, align: "right" },
        { label: "Paid", w: 62, align: "right" },
        { label: "Balance", w: 62, align: "right" },
        { label: "Status", w: 55 },
      ],
      months.map((m) => ({
        muted: m.status === "UPCOMING",
        cells: [
          [m.label, m.fees.join(", ")],
          rupees(m.charged),
          m.late + m.lateDue ? `${rupees(m.late + m.lateDue)}${m.lateDue ? " (due)" : ""}` : "—",
          m.discount ? rupees(m.discount) : "—",
          m.paid + m.late ? rupees(m.paid + m.late) : "—",
          m.balance ? rupees(m.balance) : "—",
          STATUS_LABEL[m.status],
        ],
      })),
    );
  }

  if (statement.length) {
    w.y -= 10;
    w.ensure(40);
    w.text("Statement", M, { size: 10.5, bold: true });
    w.y -= 14;
    const info = (k: string) => k === "WAIVER" || k === "CANCELLED";
    w.table(
      [
        { label: "Date", w: 62 },
        { label: "Particulars", w: 190 },
        { label: "Receipt", w: 75 },
        { label: "Charged", w: 62, align: "right" },
        { label: "Paid / off", w: 62, align: "right" },
        { label: "Balance", w: 66, align: "right" },
      ],
      statement.map((e) => ({
        muted: e.kind === "CANCELLED",
        cells: [
          fmtDate(e.date),
          [KIND_TAG[e.kind] && !e.particulars.startsWith(KIND_TAG[e.kind]!) ? `${e.particulars} [${KIND_TAG[e.kind]}]` : e.particulars, ...(e.detail ? [e.detail] : [])],
          e.receipt?.number ?? "—",
          info(e.kind) || !e.debit ? "" : rupees(e.debit),
          info(e.kind) || !e.credit ? "" : rupees(e.credit),
          info(e.kind) ? "" : rupees(e.balance),
        ],
      })),
      ["", `Balance due as of ${fmtDate(ledger.today)}`, "", rupees(statement.reduce((n, e) => n + e.debit, 0)), rupees(statement.reduce((n, e) => n + e.credit, 0)), rupees(sums.dueNow)],
    );
  }

  footer(w, `Fee ledger · ${name} (${student.studentCode}) · Session ${session.name}`);
  return { bytes: await doc.save(), fileName: `Fee-ledger-${student.studentCode}.pdf` };
}

/** The HTTP response for a generated PDF: a download, or shown in the browser with `inline`. */
export function pdfResponse({ bytes, fileName }: { bytes: Uint8Array; fileName: string }, inline = false) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
