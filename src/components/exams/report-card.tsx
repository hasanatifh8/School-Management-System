import { GraduationCap } from "lucide-react";
import type { ResultRow, Sheet } from "@/lib/exam-marks";
import { GRADES, PASS_PERCENT, formatExamDate, formatMarks } from "@/lib/exams-shared";

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
      Grades: {GRADES.map((g, i) => `${g.grade} ${g.min}${i ? `–${GRADES[i - 1].min - 1}` : "–100"}%`).join(" · ")}. Pass mark {PASS_PERCENT}% in each subject. AB = absent.
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

/** One student's report card, as an A4 sheet. */
export function ReportCard({ sheet, school, row, total, className = "" }: { sheet: Sheet; school: SchoolHeader; row: ResultRow; total: number; className?: string }) {
  const r = row;
  return (
    <article
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
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left [print-color-adjust:exact]">
            <th className={cell}>Subject</th>
            <th className={`${cell} text-center`}>Max. marks</th>
            <th className={`${cell} text-center`}>Marks obtained</th>
            <th className={`${cell} text-center`}>Grade</th>
          </tr>
        </thead>
        <tbody>
          {r.cells
            .filter((c) => c.kind !== "na")
            .map((c) => {
              const p = sheet.papers.find((x) => x.id === c.paperId)!;
              return (
                <tr key={c.paperId}>
                  <td className={`${cell} font-medium`}>{p.name}</td>
                  <td className={`${cell} text-center tabular-nums`}>{p.maxMarks}</td>
                  <td className={`${cell} text-center tabular-nums ${c.kind === "absent" ? "font-semibold text-rose-700" : ""}`}>{markText(c) || "—"}</td>
                  <td className={`${cell} text-center font-semibold`}>{c.kind === "marks" ? c.grade : c.kind === "absent" ? "E" : "—"}</td>
                </tr>
              );
            })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold [print-color-adjust:exact]">
            <td className={cell}>Total</td>
            <td className={`${cell} text-center tabular-nums`}>{r.max}</td>
            <td className={`${cell} text-center tabular-nums`}>{formatMarks(r.obtained)}</td>
            <td className={`${cell} text-center`}>{r.complete ? r.grade : "—"}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-[4mm] grid grid-cols-4 gap-[3mm] text-center">
        {[
          ["Percentage", r.complete && r.max ? `${r.percent.toFixed(1)}%` : "—"],
          ["Grade", r.complete ? r.grade : "—"],
          ["Rank", r.rank ? `${r.rank} of ${total}` : "—"],
          ["Result", r.result],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-slate-300 py-[2mm]">
            <p className="text-[7.5pt] uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`text-[12pt] font-bold ${value === "Fail" ? "text-rose-700" : ""}`}>{value}</p>
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
  const complete = rows.filter((r) => r.complete);
  const avg = complete.length ? complete.reduce((n, r) => n + r.percent, 0) / complete.length : 0;
  return (
    <article className="relative mx-auto overflow-hidden bg-white p-[10mm] text-[8.5pt] text-slate-900 shadow-md ring-1 ring-slate-200 print:p-0 print:shadow-none print:ring-0">
      <Watermark show={!sheet.published} />
      <SheetHeader school={school} exam={sheet.exam.name} subtitle={`Result sheet · ${sheet.section.label} · Session ${sheet.exam.session}`} />
      <div className="mb-[3mm] flex flex-wrap justify-center gap-x-[8mm] text-[9pt]">
        <span>
          Students: <b>{rows.length}</b>
        </span>
        <span>
          Passed: <b>{passed}</b>
        </span>
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
                  <span className="block text-[7pt] font-normal">/{p.maxMarks}</span>
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
                  const p = sheet.papers.find((x) => x.id === c.paperId)!;
                  const low = c.kind === "absent" || (c.kind === "marks" && (c.marks / p.maxMarks) * 100 < PASS_PERCENT);
                  return (
                    <td key={c.paperId} className={`${cell} text-center tabular-nums ${low ? "font-semibold text-rose-700" : ""}`}>
                      {markText(c)}
                    </td>
                  );
                })}
                <td className={`${cell} text-center font-semibold tabular-nums`}>
                  {formatMarks(r.obtained)}/{r.max}
                </td>
                <td className={`${cell} text-center tabular-nums`}>{r.complete && r.max ? r.percent.toFixed(1) : "—"}</td>
                <td className={`${cell} text-center font-semibold`}>{r.complete ? r.grade : "—"}</td>
                <td className={`${cell} text-center tabular-nums`}>{r.rank ?? "—"}</td>
                <td className={`${cell} text-center font-semibold ${r.result === "Fail" ? "text-rose-700" : r.result === "Incomplete" ? "text-slate-400" : ""}`}>
                  {r.result}
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
