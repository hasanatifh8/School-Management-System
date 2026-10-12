import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, GraduationCap, UserRound } from "lucide-react";
import { AttendanceChart, Legend, ProgressChart, RadarChart, Sparkline, SubjectBars, TestsVsExamChart } from "@/components/performance/charts";
import { ATTENDANCE_STATUSES, STATUS_META, formatISO } from "@/lib/attendance-shared";
import type { SchoolHeader } from "@/components/exams/report-card";
import { gradeFor } from "@/lib/exams-shared";
import type { PerformanceReport, SubjectRow } from "@/lib/performance";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";

const longDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 10) / 10}%`);

const STATUS: Record<NonNullable<SubjectRow["status"]>, { label: string; cls: string }> = {
  strength: { label: "Strength", cls: "bg-emerald-100 text-emerald-800" },
  "on-track": { label: "On track", cls: "bg-slate-100 text-slate-700" },
  focus: { label: "Focus area", cls: "bg-amber-100 text-amber-800" },
};
const TREND = {
  up: { label: "Improving", icon: ArrowUpRight, cls: "text-emerald-700" },
  steady: { label: "Steady", icon: ArrowRight, cls: "text-slate-600" },
  down: { label: "Falling", icon: ArrowDownRight, cls: "text-rose-700" },
} as const;

/**
 * The Performance Analytics Report's two A4 pages (paper colours, so they print
 * the same in light or dark mode): page 1 is the summary a parent reads in a
 * minute, page 2 the subject detail for a parent–teacher meeting.
 */
export function PerformanceReportView({ report, school, root = "performance" }: { report: PerformanceReport; school: SchoolHeader; root?: string }) {
  const { student, session, anchor, subjects, insights, attendance } = report;
  const name = fullName(student);
  const photo = photoUrl(student.photoId);
  const counts = attendance.total;
  const markedDays = ATTENDANCE_STATUSES.reduce((n, s) => n + counts[s], 0);
  const radar = subjects.filter((s) => s.exam != null);
  const showProgress = report.assessments.length >= 2;
  const kpis = [
    anchor && { label: anchor.kind === "EXAM" ? anchor.name : "Latest class test", value: pct(anchor.percent), sub: anchor.percent != null ? `Grade ${gradeFor(anchor.percent)}` : "Absent" },
    anchor?.rank != null && { label: "Class rank", value: `${anchor.rank}`, sub: `of ${anchor.outOf} students` },
    { label: "Attendance", value: pct(attendance.percent), sub: markedDays ? `${markedDays} school days marked` : "Not marked yet" },
    { label: "Class tests average", value: pct(report.testAvg), sub: report.tests.length ? `${report.tests.length} test${report.tests.length === 1 ? "" : "s"}` : "No tests yet" },
    report.top && { label: "Top subject", value: report.top.name, sub: pct(report.top.exam), small: true },
    report.improved
      ? { label: "Most improved", value: report.improved.name, sub: `+${Math.round(report.improved.by * 10) / 10} points`, small: true }
      : anchor?.classAvg != null && anchor.percent != null && { label: "Against class average", value: `${anchor.percent >= anchor.classAvg ? "+" : ""}${Math.round((anchor.percent - anchor.classAvg) * 10) / 10}`, sub: `class average ${pct(anchor.classAvg)}` },
  ].filter((k): k is { label: string; value: string; sub: string; small?: boolean } => !!k);

  return (
    <div data-pdf-root={root} className="space-y-6 print:space-y-0">
      {/* Page 1: the summary a parent reads in a minute */}
      <article data-pdf-page className={pageClass}>
        <ReportHeader school={school} session={session.name} asOf={report.asOf} />

        <section className="mt-[3mm] flex items-center gap-[4mm] rounded-lg border border-slate-300 px-[4mm] py-[2.5mm]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
            <img src={photo} alt="" className="h-[16mm] w-[13mm] rounded object-cover object-top" />
          ) : (
            <span className="flex h-[16mm] w-[13mm] items-center justify-center rounded bg-slate-100">
              <UserRound className="h-[7mm] w-[7mm] text-slate-400" />
            </span>
          )}
          <dl className="grid flex-1 grid-cols-3 gap-x-[4mm] gap-y-[1mm] text-[8.5pt]">
            <Bio label="Student" value={name} strong />
            <Bio label="Class" value={student.section ? sectionLabel(student.section) : "—"} />
            <Bio label="Roll No" value={student.rollNumber != null ? String(student.rollNumber) : "—"} />
            <Bio label="Student ID" value={student.studentCode} />
            <Bio label="Father" value={student.fatherName ?? "—"} />
            <Bio label="Class teacher" value={student.section?.classTeacher ? fullName(student.section.classTeacher) : "—"} />
          </dl>
        </section>

        <p className="mt-[3mm] rounded-lg bg-indigo-50 px-[4mm] py-[2.5mm] text-[9.5pt] leading-snug text-slate-800">{insights.summary}</p>

        <div className={`mt-[3mm] grid gap-[2.5mm] ${kpis.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-slate-300 px-[3mm] py-[2mm]">
              <p className="truncate text-[7pt] font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
              <p className={`truncate font-bold leading-tight text-slate-900 ${k.small ? "text-[12pt]" : "text-[16pt]"}`}>{k.value}</p>
              <p className="truncate text-[7.5pt] text-slate-600">{k.sub}</p>
            </div>
          ))}
        </div>

        <ChartBlock
          title="Progress through the session"
          note={showProgress ? "Overall percentage in each class test and exam, in date order" : "Progress tracking starts after the next class test or exam."}
          legend={
            showProgress && (
              <Legend
                items={[
                  { label: "Class test", swatch: "circle" },
                  { label: "Exam", swatch: "square" },
                  { label: "Class average", swatch: "dashed" },
                ]}
              />
            )
          }
        >
          {showProgress && <ProgressChart points={report.assessments.map((a) => ({ label: a.short, value: a.percent, kind: a.kind, classAvg: a.classAvg }))} />}
        </ChartBlock>

        <ChartBlock
          title="Attendance by month"
          note={markedDays ? `${pct(attendance.percent)} this session` : "No attendance marked yet this session."}
          legend={
            markedDays > 0 && (
              <Legend
                items={[
                  { label: name.split(" ")[0], swatch: "solid" },
                  { label: "Class", swatch: "dashed" },
                  { label: "75% minimum", swatch: "limit" },
                ]}
              />
            )
          }
        >
          {markedDays > 0 && (
            <>
              <AttendanceChart months={attendance.months} />
              <p className="mt-[1mm] flex flex-wrap gap-x-[4mm] text-[7.5pt] text-slate-600">
                {ATTENDANCE_STATUSES.map((s) => (
                  <span key={s}>
                    {STATUS_META[s].label}: <strong className="font-semibold text-slate-800">{counts[s]}</strong>
                  </span>
                ))}
              </p>
            </>
          )}
        </ChartBlock>

        <Footer page={1} />
      </article>

      {/* Page 2: the detail for a parent–teacher meeting */}
      <article data-pdf-page className={`${pageClass} print:break-before-page`}>
        <p className="border-b border-slate-300 pb-[1.5mm] text-[8.5pt] text-slate-600">
          <strong className="font-semibold text-slate-900">{name}</strong> · {student.section ? sectionLabel(student.section) : ""} · Performance Analytics Report · {session.name}
        </p>

        {anchor && (
          <ChartBlock
            title={`Subjects in ${anchor.name}`}
            note="Against the class average and the highest mark in the class"
            legend={
              <Legend
                items={[
                  { label: name.split(" ")[0], swatch: "solid" },
                  { label: "Class average", swatch: "mid" },
                  { label: "Class highest", swatch: "outline" },
                ]}
              />
            }
          >
            <SubjectBars subjects={subjects.filter((s) => anchor.subjects.some((a) => a.subjectId === s.subjectId))} />
          </ChartBlock>
        )}

        <div className="mt-[3mm] grid grid-cols-2 gap-[4mm]">
          <div className="rounded-lg border border-slate-300 px-[3mm] py-[2mm]">
            <p className="text-[9pt] font-semibold text-slate-900">Subject balance</p>
            <p className="text-[7.5pt] text-slate-600">Filled: {name.split(" ")[0]} · dashed: class average</p>
            {radar.length >= 3 ? (
              <div className="mx-auto max-w-[66mm]">
                <RadarChart subjects={radar} />
              </div>
            ) : (
              <p className="py-[6mm] text-center text-[8pt] text-slate-500">Needs results in at least 3 subjects.</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-300 px-[3mm] py-[2mm]">
            <p className="text-[9pt] font-semibold text-slate-900">Class tests vs latest exam</p>
            <p className="mb-[1.5mm] text-[7.5pt] text-slate-600">Grey: class-test average · blue: exam · ! = gap of 15 points or more</p>
            <TestsVsExamChart subjects={subjects} />
          </div>
        </div>

        <table className="mt-[3mm] w-full border-collapse text-[8pt]">
          <thead>
            <tr className="bg-slate-100 text-left text-[7.5pt] uppercase tracking-wide text-slate-600">
              <th className={th}>Subject</th>
              <th className={`${th} text-right`}>{anchor?.kind === "EXAM" ? "Exam" : "Latest"}</th>
              <th className={`${th} text-right`}>Class avg</th>
              <th className={`${th} text-right`}>Highest</th>
              <th className={`${th} text-right`}>Tests avg</th>
              <th className={th}>Trend</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const trend = s.trend && TREND[s.trend];
              return (
                <tr key={s.subjectId}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{s.examAbsent ? "AB" : pct(s.exam)}</td>
                  <td className={`${td} text-right tabular-nums`}>{pct(s.classAvg)}</td>
                  <td className={`${td} text-right tabular-nums`}>{pct(s.classHigh)}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {pct(s.tests)}
                    {s.testCount > 0 && <span className="text-slate-500"> ({s.testCount})</span>}
                  </td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-[1.5mm]">
                      <Sparkline history={s.history} />
                      {trend ? (
                        <span className={`inline-flex items-center gap-[0.5mm] ${trend.cls}`}>
                          <trend.icon className="h-[3mm] w-[3mm]" /> {trend.label}
                        </span>
                      ) : (
                        <span className="text-slate-500">Not enough data</span>
                      )}
                    </span>
                  </td>
                  <td className={td}>{s.status ? <span className={`rounded px-[1.5mm] py-[0.3mm] text-[7.5pt] font-semibold ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-[3mm] grid grid-cols-2 gap-[3mm] text-[8.5pt]">
          <Insight title="Strengths" empty="None yet: no subject at 75% or more and above the class average.">
            {insights.strengths.map((s) => `${s.name} (${pct(s.exam)})`)}
          </Insight>
          <Insight title="Focus areas" empty="No subject below 50% or well under the class average.">
            {insights.focus.map((s) => `${s.name} (${pct(s.exam)}${s.classAvg != null ? `, class ${pct(s.classAvg)}` : ""})`)}
          </Insight>
          <Insight title="Observations" empty="—">
            {insights.notes}
          </Insight>
          <Insight title="Suggested actions" empty="—">
            {insights.actions}
          </Insight>
        </div>

        <div className="mt-[3mm] rounded-lg border border-slate-300 px-[3mm] py-[2mm]">
          <p className="text-[9pt] font-semibold text-slate-900">Class teacher&apos;s remarks</p>
          <div className="mt-[4mm] space-y-[5mm]">
            <div className="border-b border-dotted border-slate-400" />
            <div className="border-b border-dotted border-slate-400" />
          </div>
        </div>

        <div className="flex justify-between gap-[8mm] pt-[7mm] text-[8pt] text-slate-600">
          {["Class teacher", "Principal", "Parent / guardian"].map((l) => (
            <span key={l} className="flex-1 border-t border-slate-400 pt-[1mm] text-center">
              {l}
            </span>
          ))}
        </div>

        <Footer page={2} />
      </article>
    </div>
  );
}

const pageClass =
  "mx-auto w-full max-w-[190mm] rounded-2xl bg-white p-[8mm] text-[9pt] leading-snug text-slate-900 shadow-lift [print-color-adjust:exact] print:max-w-none print:rounded-none print:p-0 print:shadow-none";
const th = "border-b border-slate-300 px-[1.5mm] py-[1mm] font-semibold";
const td = "border-b border-slate-200 px-[1.5mm] py-[0.8mm]";

function ReportHeader({ school, session, asOf }: { school: SchoolHeader; session: string; asOf: string }) {
  return (
    <header className="flex items-center gap-[4mm] border-b-2 border-slate-800 pb-[3mm]">
      {school.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
        <img src={school.logoUrl} alt="" className="h-[15mm] w-[15mm] object-contain" />
      ) : (
        <span className="flex h-[15mm] w-[15mm] items-center justify-center rounded-full bg-slate-100">
          <GraduationCap className="h-[8mm] w-[8mm] text-slate-500" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14pt] font-bold uppercase leading-tight tracking-wide">{school.name}</p>
        {school.address && <p className="text-[8pt] text-slate-600">{school.address.replace(/\n/g, ", ")}</p>}
        {school.contact && <p className="text-[8pt] text-slate-600">{school.contact}</p>}
      </div>
      <div className="text-right">
        <p className="text-[11pt] font-bold leading-tight text-indigo-700">Performance Analytics Report</p>
        <p className="text-[8.5pt] text-slate-600">Session {session}</p>
        <p className="text-[8pt] text-slate-500">As of {formatISO(asOf, longDate)}</p>
      </div>
    </header>
  );
}

function Bio({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[7pt] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`truncate ${strong ? "font-bold text-slate-900" : "text-slate-800"}`}>{value}</dd>
    </div>
  );
}

function ChartBlock({ title, note, legend, children }: { title: string; note: string; legend?: ReactNode; children?: ReactNode }) {
  return (
    <section className="mt-[3mm] rounded-lg border border-slate-300 px-[3mm] py-[2mm]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-[4mm] gap-y-[1mm]">
        <p className="text-[9pt] font-semibold text-slate-900">
          {title} <span className="font-normal text-slate-600">· {note}</span>
        </p>
        {legend}
      </div>
      {children}
    </section>
  );
}

function Insight({ title, empty, children }: { title: string; empty: string; children: string[] }) {
  return (
    <div className="rounded-lg border border-slate-300 px-[3mm] py-[2mm]">
      <p className="text-[9pt] font-semibold text-slate-900">{title}</p>
      {children.length ? (
        <ul className="mt-[1mm] list-disc space-y-[0.5mm] pl-[4mm] text-slate-800">
          {children.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-[1mm] text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function Footer({ page }: { page: number }) {
  return (
    <p className="mt-[3mm] flex justify-between border-t border-slate-300 pt-[1.5mm] text-[7pt] text-slate-500">
      <span>A companion to the official report card, not a marksheet. Built from published class tests, exams and attendance; absent papers are not counted as zero.</span>
      <span className="shrink-0 pl-[4mm]">Page {page} of 2</span>
    </p>
  );
}
