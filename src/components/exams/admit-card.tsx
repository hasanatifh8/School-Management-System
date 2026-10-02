import { GraduationCap, UserRound } from "lucide-react";
import type { AdmitCardData, AdmitCardStudent } from "@/lib/admit-cards";
import { formatDay, formatExamDate, timeRange } from "@/lib/exams-shared";

const cell = "border border-slate-400 px-[1.5mm] py-[0.8mm]";

/** One student's admit card: half an A4 sheet (two print on a page). */
export function AdmitCard({ data, student }: { data: AdmitCardData; student: AdmitCardStudent }) {
  const { school, exam, section } = data;
  const instructions = (exam.instructions ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <article className="flex min-h-[130mm] w-[190mm] flex-col border-2 border-slate-800 bg-white p-[5mm] text-[8.5pt] leading-snug text-slate-900">
      <header className="flex items-center gap-[4mm] border-b-2 border-slate-800 pb-[2.5mm]">
        {school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
          <img src={school.logoUrl} alt="" className="h-[15mm] w-[15mm] object-contain" />
        ) : (
          <span className="flex h-[14mm] w-[14mm] items-center justify-center rounded-full bg-slate-100">
            <GraduationCap className="h-[7mm] w-[7mm] text-slate-500" />
          </span>
        )}
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[13pt] font-bold uppercase leading-tight tracking-wide">{school.name}</p>
          {school.address && <p className="text-[7.5pt] text-slate-600">{school.address.replace(/\n/g, ", ")}</p>}
          <p className="mt-[1mm] text-[10pt] font-bold">{exam.name}</p>
          <p className="text-[7.5pt] uppercase tracking-wider text-slate-600">Session {exam.session}</p>
        </div>
        <span className="rounded border-2 border-slate-800 px-[2.5mm] py-[1mm] text-[10pt] font-black uppercase tracking-widest">Admit card</span>
      </header>

      <div className="mt-[3mm] flex gap-[4mm]">
        <dl className="grid flex-1 grid-cols-[auto_1fr] content-start gap-x-[4mm] gap-y-[1.2mm]">
          <dt className="text-slate-500">Student</dt>
          <dd className="text-[10pt] font-bold">{student.name}</dd>
          <dt className="text-slate-500">{student.guardian.label}</dt>
          <dd className="font-semibold">{student.guardian.name ?? "—"}</dd>
          <dt className="text-slate-500">Class</dt>
          <dd className="font-semibold">{section.label}</dd>
          <dt className="text-slate-500">Roll no.</dt>
          <dd className="text-[10pt] font-bold tabular-nums">{student.rollNumber ?? "—"}</dd>
          <dt className="text-slate-500">Student ID</dt>
          <dd className="font-mono">{student.studentCode}</dd>
        </dl>
        <div className="flex h-[32mm] w-[26mm] shrink-0 items-center justify-center overflow-hidden border border-slate-400 bg-slate-50">
          {student.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
            <img src={student.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center text-[6.5pt] text-slate-400">
              <UserRound className="h-[9mm] w-[9mm]" />
              Paste photo
            </span>
          )}
        </div>
      </div>

      <table className="mt-[3mm] w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left [print-color-adjust:exact]">
            <th className={cell}>Date</th>
            <th className={cell}>Day</th>
            <th className={cell}>Time</th>
            <th className={cell}>Subject</th>
            <th className={`${cell} w-[25mm] text-center`}>Invigilator</th>
          </tr>
        </thead>
        <tbody>
          {student.papers.length === 0 ? (
            <tr>
              <td colSpan={5} className={`${cell} text-center text-slate-500`}>
                The date sheet has no papers yet.
              </td>
            </tr>
          ) : (
            student.papers.map((p) => (
              <tr key={p.id}>
                <td className={`${cell} whitespace-nowrap`}>{formatExamDate(p.date)}</td>
                <td className={cell}>{formatDay(p.date)}</td>
                <td className={`${cell} whitespace-nowrap`}>{timeRange(p.startTime, p.endTime)}</td>
                <td className={`${cell} font-medium`}>
                  {p.subject}
                  {p.room && <span className="font-normal text-slate-500"> · {p.room}</span>}
                </td>
                <td className={cell} />
              </tr>
            ))
          )}
        </tbody>
      </table>

      {instructions.length > 0 && (
        <div className="mt-[2.5mm]">
          <p className="font-semibold">Instructions</p>
          <ol className="ml-[4mm] list-decimal text-[7.5pt] text-slate-700">
            {instructions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto flex justify-between gap-[8mm] pt-[10mm] text-[7.5pt] text-slate-600">
        <div className="min-w-[38mm] border-t border-slate-600 pt-[1mm] text-center">Student&apos;s signature</div>
        <div className="min-w-[38mm] border-t border-slate-600 pt-[1mm] text-center">Class teacher</div>
        <div className="min-w-[38mm] border-t border-slate-600 pt-[1mm] text-center">
          Principal
          {school.principalName && <span className="block text-slate-500">{school.principalName}</span>}
        </div>
      </div>
    </article>
  );
}

/** Cards two to an A4 page, each page captured as one PDF page. */
export function AdmitCardPages({ data, students }: { data: AdmitCardData; students: AdmitCardStudent[] }) {
  const pages: AdmitCardStudent[][] = [];
  for (let i = 0; i < students.length; i += 2) pages.push(students.slice(i, i + 2));
  return (
    <div className="space-y-6 print:space-y-0">
      {pages.map((pair, i) => (
        <section
          key={pair[0].id}
          data-pdf-page
          className={`mx-auto flex w-[210mm] flex-col items-center gap-[8mm] bg-white px-[10mm] py-[8mm] shadow-md ring-1 ring-slate-200 print:shadow-none print:ring-0 ${i > 0 ? "print:break-before-page" : ""}`}
        >
          {pair.map((s) => (
            <AdmitCard key={s.id} data={data} student={s} />
          ))}
        </section>
      ))}
    </div>
  );
}
