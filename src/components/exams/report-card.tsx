import { GraduationCap } from "lucide-react";
import type { ResultRow, Sheet } from "@/lib/exam-marks";
import { GRADES, PASS_PERCENT, RESULT_LABELS, formatExamDate, formatMarks, gradeFor } from "@/lib/exams-shared";

/** A cell below its paper's pass mark (or absent). */
const isLow = (c: Cell) => c.kind === "absent" || (c.kind === "marks" && !c.pass);

export type SchoolHeader = { name: string; address: string | null; contact: string; logoUrl: string | null };

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const cell = "border border-slate-400 px-[1.5mm] py-[1mm]";

type Cell = ResultRow["cells"][number];
export const markText = (c: Cell) => (c.kind === "na" ? "—" : c.kind === "missing" ? "" : c.kind === "absent" ? "AB" : formatMarks(c.marks));

function SheetHeader({ school, exam, subtitle }: { school: SchoolHeader; exam: string; subtitle: string }) {
  return (
    <header className="mb-[4mm] border-b-2 border-slate-800 pb-[3mm] text-center">
      <div className="flex items-center justify-center gap-[4mm]">
        {school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
          <img src={school.logoUrl} alt="" className="h-[15mm] w-[15mm] object-contain" />
        ) : (
          <span className="flex h-[13mm] w-[13mm] items-center justify-center rounded-full bg-slate-100">
            <GraduationCap className="h-[7mm] w-[7mm] text-slate-500" />
          </span>
        )}
        <div>
          <p className="text-[14pt] font-bold uppercase leading-tight tracking-wide">{school.name}</p>
          {school.address && <p className="text-[8pt] text-slate-600">{school.address.replace(/\n/g, ", ")}</p>}
          {school.contact && <p className="text-[8pt] text-slate-600">{school.contact}</p>}
        </div>
      </div>
      <p className="mt-[2.5mm] text-[12pt] font-bold">{exam}</p>
      <p className="text-[8.5pt] uppercase tracking-wider text-slate-600">{subtitle}</p>
    </header>
  );
}

function Watermark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 whitespace-nowrap rounded-lg border-4 border-amber-500/40 px-6 py-2 text-[26pt] font-black uppercase tracking-widest text-amber-500/40">
      Preview · not published
    </span>
  );
}

function GradeKey() {
  return (
    <p className="mt-[3mm] text-[7.5pt] text-slate-600">
      Grades: {GRADES.map((g, i) => `${g.grade} ${g.min}${i ? `–${GRADES[i - 1].min - 1}` : "–100"}%`).join(" · ")}. Pass mark {PASS_PERCENT}% in each subject unless a pass mark is shown beside it. Optional papers are not counted in the total. AB = absent.
    </p>
  );
}

function Signatures({ labels }: { labels: string[] }) {
  return (
    <div className="flex justify-between gap-[8mm] pt-[14mm] text-[8pt] text-slate-600">
      {labels.map((l) => (
        <div key={l} className="min-w-[35mm] border-t border-slate-600 pt-[1mm] text-center">
          {l}
        </div>
      ))}
    </div>
  );
}

type Paper = Sheet["papers"][number];
type Part = { paper: Paper; cell: Cell };

/** Marks in some papers taken together: "AB" if absent from all, blank while any is missing. */
function partsText(parts: Part[]) {
  if (!parts.length) return "—";
  if (parts.some((p) => p.cell.kind === "missing")) return "";
  if (parts.every((p) => p.cell.kind === "absent")) return "AB";
  return formatMarks(parts.reduce((n, p) => n + (p.cell.kind === "marks" ? p.cell.marks : 0), 0));
}
const partsMax = (parts: Part[]) => parts.reduce((n, p) => n + p.paper.maxMarks, 0);

/**
 * A student's papers, one line each; a subject with a practical paper is one
 * line with its theory and practical marks side by side, then their total.
 */
function MarksTable({ sheet, row }: { sheet: Sheet; row: ResultRow }) {
  const parts: Part[] = row.cells.filter((c) => c.kind !== "na").map((c) => ({ cell: c, paper: sheet.papers.find((p) => p.id === c.paperId)! }));
  const withPractical = new Set(parts.filter((p) => p.paper.practical && p.paper.subjectId).map((p) => p.paper.subjectId));
  const lines: { key: string; name: string; theory: Part[]; practical: Part[] }[] = [];
  for (const part of parts) {
    const subjectId = part.paper.subjectId;
    if (subjectId && withPractical.has(subjectId)) {
      let line = lines.find((l) => l.key === subjectId);
      if (!line) lines.push((line = { key: subjectId, name: part.paper.subjectName ?? part.paper.name, theory: [], practical: [] }));
      (part.paper.practical ? line.practical : line.theory).push(part);
    } else {
      lines.push({ key: part.paper.id, name: part.paper.name, theory: [part], practical: [] });
    }
  }
  const split = withPractical.size > 0;
  const low = (ps: Part[]) => ps.some((p) => isLow(p.cell));
  const passNote = (line: (typeof lines)[number]) => {
    const pass = (ps: Part[]) => ps.map((p) => p.paper.passMarks).filter((m) => m != null);
    if (!line.practical.length) return line.theory[0].paper.passMarks != null ? `pass ${line.theory[0].paper.passMarks}` : null;
    const [th, pr] = [pass(line.theory), pass(line.practical)];
    return th.length || pr.length ? `pass ${[th.length && `Th ${th.join("+")}`, pr.length && `Pr ${pr.join("+")}`].filter(Boolean).join(" · ")}` : null;
  };

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-slate-100 text-left [print-color-adjust:exact]">
          <th className={cell}>Subject</th>
          <th className={`${cell} text-center`}>Max. marks</th>
          {split && <th className={`${cell} text-center`}>Theory</th>}
          {split && <th className={`${cell} text-center`}>Practical</th>}
          <th className={`${cell} text-center`}>{split ? "Total" : "Marks obtained"}</th>
          <th className={`${cell} text-center`}>Grade</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const all = [...line.theory, ...line.practical];
          const optional = all.every((p) => p.paper.optional);
          const max = partsMax(all);
          const total = partsText(all);
          const absent = total === "AB";
          const grade = absent ? "E" : total && total !== "—" ? gradeFor((Number(total) / max) * 100) : "—";
          const note = [optional && "Optional", passNote(line)].filter(Boolean).join(" · ");
          return (
            <tr key={line.key} className={optional ? "text-slate-600" : ""}>
              <td className={`${cell} font-medium`}>
                {line.name}
                {note && <span className="ml-[1.5mm] text-[7.5pt] font-normal text-slate-500">{note}</span>}
              </td>
              <td className={`${cell} text-center tabular-nums`}>{max}</td>
              {split && (
                <td className={`${cell} text-center tabular-nums ${low(line.theory) ? "font-semibold text-rose-700" : ""}`}>
                  {partsText(line.theory) || "—"}
                  {line.practical.length > 0 && line.theory.length > 0 && <span className="text-[7pt] font-normal text-slate-500">/{partsMax(line.theory)}</span>}
                </td>
              )}
              {split && (
                <td className={`${cell} text-center tabular-nums ${low(line.practical) ? "font-semibold text-rose-700" : ""}`}>
                  {partsText(line.practical) || "—"}
                  {line.practical.length > 0 && <span className="text-[7pt] font-normal text-slate-500">/{partsMax(line.practical)}</span>}
                </td>
              )}
              <td className={`${cell} text-center tabular-nums ${low(all) ? "font-semibold text-rose-700" : ""}`}>{total || "—"}</td>
              <td className={`${cell} text-center font-semibold`}>{grade}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="bg-slate-50 font-semibold [print-color-adjust:exact]">
          <td className={cell}>Total</td>
          <td className={`${cell} text-center tabular-nums`}>{row.max}</td>
          {split && <td className={cell} />}
          {split && <td className={cell} />}
          <td className={`${cell} text-center tabular-nums`}>{formatMarks(row.obtained)}</td>
          <td className={`${cell} text-center`}>{row.complete ? row.grade : "—"}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** One student's report card, as an A4 sheet. */
export function ReportCard({ sheet, school, row, total, className = "" }: { sheet: Sheet; school: SchoolHeader; row: ResultRow; total: number; className?: string }) {
  const r = row;
  return (
    <article
      data-pdf-page
      className={`relative overflow-hidden bg-white p-[12mm] text-[9.5pt] text-slate-900 shadow-md ring-1 ring-slate-200 print:p-0 print:shadow-none print:ring-0 ${className}`}
    >
      <Watermark show={!sheet.published} />
      <SheetHeader school={school} exam={sheet.exam.name} subtitle={`Report card · Session ${sheet.exam.session}`} />
      <dl className="mb-[4mm] grid grid-cols-[auto_1fr_auto_1fr] gap-x-[4mm] gap-y-[1.5mm]">
        <dt className="text-slate-500">Student</dt>
        <dd className="font-semibold">{r.student.name}</dd>
        <dt className="text-slate-500">Class</dt>
        <dd className="font-semibold">{sheet.section.label}</dd>
        <dt className="text-slate-500">Student ID</dt>
        <dd className="font-mono">{r.student.studentCode}</dd>
        <dt className="text-slate-500">Roll no.</dt>
        <dd>{r.student.rollNumber ?? "—"}</dd>
        <dt className="text-slate-500">Father</dt>
        <dd>{r.student.fatherName ?? "—"}</dd>
        <dt className="text-slate-500">Mother</dt>
        <dd>{r.student.motherName ?? "—"}</dd>
        {r.student.dateOfBirth && (
          <>
            <dt className="text-slate-500">Date of birth</dt>
            <dd>{formatExamDate(r.student.dateOfBirth)}</dd>
          </>
        )}
      </dl>
      <MarksTable sheet={sheet} row={r} />
      <div className="mt-[4mm] grid grid-cols-4 gap-[3mm] text-center">
        {[
          ["Percentage", r.complete && r.max && !r.absent ? `${r.percent.toFixed(1)}%` : "—"],
          ["Grade", r.complete ? r.grade : "—"],
          ["Rank", r.rank ? `${r.rank} of ${total}` : "—"],
          ["Result", RESULT_LABELS[r.result]],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-slate-300 py-[2mm]">
            <p className="text-[7.5pt] uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`text-[12pt] font-bold ${value === "Fail" || value === "Absent" ? "text-rose-700" : ""}`}>{value}</p>
          </div>
        ))}
      </div>
      {r.failed.length > 0 && r.complete && (
        <p className="mt-[3mm] text-[8.5pt]">
          <span className="font-semibold">Needs improvement in:</span> {r.failed.join(", ")}
        </p>
      )}
      <div className="mt-[4mm] min-h-[14mm] rounded border border-slate-300 p-[2mm] text-[8.5pt] text-slate-500">Remarks:</div>
      <GradeKey />
      <Signatures labels={["Class teacher", "Parent", "Principal"]} />
    </article>
  );
}

/** The whole section's results as one printable table. */
export function ResultSheet({ sheet, school, rows }: { sheet: Sheet; school: SchoolHeader; rows: ResultRow[] }) {
  const passed = rows.filter((r) => r.result === "Pass").length;
  const complete = rows.filter((r) => r.complete && r.max && !r.absent);
  const avg = complete.length ? complete.reduce((n, r) => n + r.percent, 0) / complete.length : 0;
  return (
    <article data-pdf-page className="relative mx-auto overflow-hidden bg-white p-[10mm] text-[8.5pt] text-slate-900 shadow-md ring-1 ring-slate-200 print:p-0 print:shadow-none print:ring-0">
      <Watermark show={!sheet.published} />
      <SheetHeader school={school} exam={sheet.exam.name} subtitle={`Result sheet · ${sheet.section.label} · Session ${sheet.exam.session}`} />
      <div className="mb-[3mm] flex flex-wrap justify-center gap-x-[8mm] text-[9pt]">
        <span>
          Students: <b>{rows.length}</b>
        </span>
        {sheet.published && (
          <span>
            Passed: <b>{passed}</b>
          </span>
        )}
        <span>
          Class average: <b>{complete.length ? `${avg.toFixed(1)}%` : "—"}</b>
        </span>
        {sheet.published && <span>Published {stamp.format(new Date(sheet.published.at))}</span>}
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 [print-color-adjust:exact]">
              <th className={cell}>Roll</th>
              <th className={`${cell} text-left`}>Student</th>
              {sheet.papers.map((p) => (
                <th key={p.id} className={`${cell} text-center`}>
                  {p.name}
                  <span className="block text-[7pt] font-normal">
                    /{p.maxMarks}
                    {p.optional && " · optional"}
                  </span>
                </th>
              ))}
              <th className={`${cell} text-center`}>Total</th>
              <th className={`${cell} text-center`}>%</th>
              <th className={`${cell} text-center`}>Grade</th>
              <th className={`${cell} text-center`}>Rank</th>
              <th className={`${cell} text-center`}>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student.id} className="break-inside-avoid">
                <td className={`${cell} text-center`}>{r.student.rollNumber ?? "—"}</td>
                <td className={`${cell} whitespace-nowrap font-medium`}>{r.student.name}</td>
                {r.cells.map((c) => {
                  return (
                    <td key={c.paperId} className={`${cell} text-center tabular-nums ${isLow(c) ? "font-semibold text-rose-700" : ""}`}>
                      {markText(c)}
                    </td>
                  );
                })}
                <td className={`${cell} text-center font-semibold tabular-nums`}>
                  {formatMarks(r.obtained)}/{r.max}
                </td>
                <td className={`${cell} text-center tabular-nums`}>{r.complete && r.max && !r.absent ? r.percent.toFixed(1) : "—"}</td>
                <td className={`${cell} text-center font-semibold`}>{r.complete ? r.grade : "—"}</td>
                <td className={`${cell} text-center tabular-nums`}>{r.rank ?? "—"}</td>
                <td className={`${cell} text-center font-semibold ${r.result === "Fail" || r.result === "Absent" ? "text-rose-700" : r.result === "Incomplete" || r.result === "Awaited" ? "text-slate-400" : ""}`}>
                  {RESULT_LABELS[r.result]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GradeKey />
      <Signatures labels={["Class teacher", "Exam in-charge", "Principal"]} />
    </article>
  );
}
