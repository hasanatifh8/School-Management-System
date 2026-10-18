import { GraduationCap } from "lucide-react";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import type { Payslip } from "@/lib/payroll";
import { CATEGORY_LABELS, CATEGORY_SHORT } from "@/lib/leave-shared";
import { rupeesInWords, type SlipLine } from "@/lib/payroll-shared";

const monthTitle = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`));
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const cell = "border border-slate-300 px-[2.5mm] py-[1.6mm]";

/** One salary slip on an A4 page, for screen, print and PDF (`data-pdf-page`). */
export function SalarySlip({ slip }: { slip: Payslip }) {
  const earnings = slip.lines.filter((l) => l.kind === "EARNING");
  const deductions = slip.lines.filter((l) => l.kind === "DEDUCTION");
  const gross = earnings.reduce((n, l) => n + l.amount, 0);
  const totalDeductions = deductions.reduce((n, l) => n + l.amount, 0);
  const rows = Math.max(earnings.length, deductions.length);
  const details: [string, string | null][] = [
    ["Employee", slip.name],
    ["Employee ID", slip.code],
    ["Designation", slip.role],
    ["Department", slip.department],
    ["Date of joining", slip.joined && fmt(slip.joined)],
    ["Paid on", `${fmt(slip.paidOn)} · ${MODE_LABELS[slip.mode]}`],
  ];

  return (
    <article
      data-pdf-page
      className="relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white p-[12mm] text-[9.5pt] text-slate-900 shadow-md ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0"
    >
      {!slip.published && (
        <p
          aria-label="Draft: not published to the employee"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] select-none text-[64pt] font-black uppercase tracking-widest text-slate-900/[0.06]"
        >
          Draft
        </p>
      )}
      <header className="flex items-center gap-[4mm] border-b-2 border-slate-800 pb-[3mm]">
        {slip.school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
          <img src={slip.school.logoUrl} alt="" className="h-[16mm] w-[16mm] object-contain" />
        ) : (
          <span className="flex h-[14mm] w-[14mm] items-center justify-center rounded-full bg-slate-100">
            <GraduationCap className="h-[7mm] w-[7mm] text-slate-500" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14pt] font-bold uppercase leading-tight tracking-wide">{slip.school.name}</p>
          {slip.school.address && <p className="text-[8pt] text-slate-600">{slip.school.address.replace(/\n/g, ", ")}</p>}
          {slip.school.contact && <p className="text-[8pt] text-slate-600">{slip.school.contact}</p>}
        </div>
        <div className="text-right">
          <p className="text-[8pt] uppercase tracking-wider text-slate-500">Salary slip</p>
          <p className="text-[12pt] font-bold">{monthTitle.format(new Date(`${slip.month}-01T00:00:00Z`))}</p>
        </div>
      </header>

      <dl className="mt-[4mm] grid grid-cols-2 gap-x-[8mm] gap-y-[1.6mm]">
        {details.map(([label, value]) => (
          <div key={label} className="flex gap-[2mm]">
            <dt className="w-[30mm] shrink-0 text-slate-500">{label}</dt>
            <dd className="font-medium">{value || "—"}</dd>
          </div>
        ))}
      </dl>

      {slip.attendance && (
        <section className="mt-[4mm]">
          <p className="mb-[1.5mm] text-[7.5pt] font-semibold uppercase tracking-wider text-slate-500">Attendance this month</p>
          <div className="grid grid-cols-7 gap-[1.5mm] text-center">
            {[
              ["Days in month", slip.daysInMonth],
              ["Working days", slip.attendance.workingDays],
              ["Present", slip.attendance.present],
              ["Absent", slip.attendance.absent],
              ["Half days", slip.attendance.halfDay],
              ["On leave", slip.attendance.leave],
              ["Unpaid days", slip.lopDays ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-slate-300 py-[1.6mm] [print-color-adjust:exact]">
                <p className="text-[6.5pt] uppercase tracking-wider text-slate-500">{label}</p>
                <p className="text-[11pt] font-semibold tabular-nums">{num(Number(value))}</p>
              </div>
            ))}
          </div>
          <p className="mt-[1.2mm] text-[7.5pt] text-slate-500">
            Present counts late arrivals; a half day counts as half. Unpaid days = absent days + half of each half day, not on approved leave
            {slip.lopDays ? "" : " (not deducted this month)"}.
          </p>
        </section>
      )}

      {(slip.leaveTaken.length > 0 || slip.leaveBalance) && (
        <section className="mt-[3mm] grid grid-cols-2 gap-[4mm]">
          <div>
            <p className="mb-[1.5mm] text-[7.5pt] font-semibold uppercase tracking-wider text-slate-500">Leave taken this month</p>
            {slip.leaveTaken.length === 0 ? (
              <p className="text-slate-600">None</p>
            ) : (
              <ul className="space-y-[0.8mm]">
                {slip.leaveTaken.map((l) => (
                  <li key={l.category} className="flex justify-between gap-[2mm]">
                    <span>{CATEGORY_LABELS[l.category]}</span>
                    <span className="font-medium tabular-nums">{num(l.days)} day{l.days === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {slip.leaveBalance && slip.leaveBalance.rows.length > 0 && (
            <div>
              <p className="mb-[1.5mm] text-[7.5pt] font-semibold uppercase tracking-wider text-slate-500">Leave balance · session {slip.leaveBalance.session}</p>
              <ul className="space-y-[0.8mm]">
                {slip.leaveBalance.rows.map((r) => (
                  <li key={r.category} className="flex justify-between gap-[2mm]">
                    <span>{CATEGORY_SHORT[r.category]}</span>
                    <span className="tabular-nums">
                      {r.used} used of {r.allowed} · <span className="font-medium">{Math.max(0, r.allowed! - r.used)} left</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <table className="mt-[4mm] w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left [print-color-adjust:exact]">
            <th className={cell}>Earnings</th>
            <th className={`${cell} w-[28mm] text-right`}>Amount</th>
            <th className={cell}>Deductions</th>
            <th className={`${cell} w-[28mm] text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(rows, 1) }, (_, i) => (
            <tr key={i}>
              <td className={cell}>
                <LineName line={earnings[i]} />
              </td>
              <td className={`${cell} text-right tabular-nums`}>{earnings[i] ? rupees(earnings[i].amount) : ""}</td>
              <td className={cell}>{deductions[i] ? <LineName line={deductions[i]} /> : i === 0 && !deductions.length ? "None" : ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{deductions[i] ? rupees(deductions[i].amount) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold [print-color-adjust:exact]">
            <td className={cell}>Gross earnings</td>
            <td className={`${cell} text-right tabular-nums`}>{rupees(gross)}</td>
            <td className={cell}>Total deductions</td>
            <td className={`${cell} text-right tabular-nums`}>{rupees(totalDeductions)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-[4mm] flex items-center justify-between gap-[4mm] rounded border-2 border-slate-800 px-[4mm] py-[3mm]">
        <div>
          <p className="text-[8pt] uppercase tracking-wider text-slate-500">Net pay</p>
          <p className="text-[8.5pt] italic text-slate-600">{rupeesInWords(slip.amount)}</p>
        </div>
        <p className="text-[16pt] font-bold tabular-nums">{rupees(slip.amount)}</p>
      </div>

      {deductions.length > 0 && (
        <section className="mt-[3mm] rounded border border-slate-300 px-[3mm] py-[2mm] [print-color-adjust:exact]">
          <p className="mb-[1mm] text-[7.5pt] font-semibold uppercase tracking-wider text-slate-500">Why these deductions</p>
          <ul className="space-y-[0.8mm] text-[8.5pt]">
            {deductions.map((d, i) => (
              <li key={i} className="flex gap-[2mm]">
                <span className="w-[42mm] shrink-0 font-medium">{d.name}</span>
                <span className="flex-1 text-slate-600">{d.note || "Deducted as set in the salary structure"}</span>
                <span className="font-medium tabular-nums">−{rupees(d.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {slip.note && (
        <p className="mt-[3mm] text-[8.5pt]">
          <span className="font-semibold">Note:</span> {slip.note}
        </p>
      )}
      <p className="mt-[3mm] text-[7.5pt] text-slate-500">
        Unpaid days are absent days plus half of each half day, not on approved leave; a day&apos;s pay is the month&apos;s gross divided by {slip.daysInMonth}. This is a
        computer-generated slip.
      </p>

      <div className="flex justify-between gap-[8mm] pt-[16mm] text-[8pt] text-slate-600">
        {["Employee", "Accountant", "Principal"].map((l) => (
          <div key={l} className="min-w-[35mm] border-t border-slate-600 pt-[1mm] text-center">
            {l}
          </div>
        ))}
      </div>
    </article>
  );
}

/** A slip line's name, with how it was worked out underneath. */
function LineName({ line }: { line?: SlipLine }) {
  if (!line) return null;
  return (
    <>
      {line.name}
      {line.note && <span className="block text-[7pt] leading-tight text-slate-500">{line.note}</span>}
    </>
  );
}
