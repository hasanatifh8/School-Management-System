import { GraduationCap } from "lucide-react";
import { isSunday, parseISODate } from "@/lib/attendance-shared";

const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "narrow", timeZone: "UTC" });
const printed = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Rows per A4 landscape sheet. */
const ROWS_PER_PAGE = 22;

/** Print colours for each mark (P green, A red, L orange, HD yellow, LV violet, H grey). */
const CELL_TONE: Record<string, string> = {
  P: "text-emerald-700",
  A: "bg-rose-100 text-rose-700",
  L: "text-orange-600",
  HD: "bg-yellow-100 text-yellow-800",
  LV: "text-violet-700",
  H: "bg-slate-100 text-slate-400",
};

export type PrintRow = { name: string; sub: string; cells: Record<string, string>; totals: string[] };

/**
 * A monthly register laid out as A4 landscape sheets: school header on every
 * sheet, a day-by-day grid with totals, and the signature block on the last.
 * Each sheet is a `[data-pdf-page]` for the PDF download.
 */
export function RegisterPrintSheets({
  root,
  school,
  logoUrl,
  title,
  subtitle,
  dates,
  holidays,
  rows,
  totalHeads,
  legend,
  signatures,
}: {
  root: string;
  school: { name: string; address: string | null; phone: string | null; principalName: string | null };
  logoUrl: string | null;
  title: string;
  subtitle: string;
  dates: string[];
  holidays: Record<string, string>;
  rows: PrintRow[];
  totalHeads: string[];
  legend: string;
  /** Labels over the signature lines, e.g. ["Class teacher", "Principal"]. */
  signatures: string[];
}) {
  const pages: PrintRow[][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += ROWS_PER_PAGE) pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  const cell = "border border-slate-300 px-[0.5mm] py-[0.8mm] text-center";

  return (
    <div data-pdf-root={root} className="space-y-6 print:space-y-0">
      <style>{`@page { size: A4 landscape; margin: 8mm; } @media print { html, body { background: #fff !important; } }`}</style>
      {pages.map((pageRows, p) => (
        <article
          key={p}
          data-pdf-page
          className="mx-auto w-full max-w-[281mm] rounded-2xl bg-white p-[6mm] text-[8pt] text-slate-900 shadow-lift [print-color-adjust:exact] print:max-w-none print:break-after-page print:rounded-none print:p-0 print:shadow-none last:print:break-after-auto"
        >
          <header className="flex items-center gap-[4mm] border-b-2 border-slate-800 pb-[2.5mm]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-[13mm] w-[13mm] object-contain" />
            ) : (
              <span className="flex h-[13mm] w-[13mm] items-center justify-center rounded-full bg-slate-100">
                <GraduationCap className="h-[7mm] w-[7mm] text-slate-500" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13pt] font-bold uppercase tracking-wide">{school.name}</p>
              {(school.address || school.phone) && (
                <p className="text-[8pt] text-slate-600">{[school.address, school.phone && `Phone ${school.phone}`].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11pt] font-bold">{title}</p>
              <p className="text-[8.5pt] text-slate-600">{subtitle}</p>
              {pages.length > 1 && (
                <p className="text-[7.5pt] text-slate-500">
                  Sheet {p + 1} of {pages.length}
                </p>
              )}
            </div>
          </header>

          <table className="mt-[3mm] w-full border-collapse text-[7.5pt]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-[1mm] py-[1mm] text-left">#</th>
                <th className="border border-slate-300 px-[1.5mm] py-[1mm] text-left">Name</th>
                {dates.map((d) => (
                  <th key={d} className={`${cell} font-semibold ${holidays[d] || isSunday(d) ? "bg-slate-200 text-slate-500" : ""}`}>
                    <span className="block text-[6pt] font-normal">{weekday.format(parseISODate(d)!)}</span>
                    {Number(d.slice(8))}
                  </th>
                ))}
                {totalHeads.map((h) => (
                  <th key={h} className="border border-slate-300 bg-slate-200 px-[1mm] py-[1mm] text-center">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i} className="break-inside-avoid">
                  <td className="border border-slate-300 px-[1mm] text-slate-500">{p * ROWS_PER_PAGE + i + 1}</td>
                  <td className="max-w-[48mm] border border-slate-300 px-[1.5mm] py-[0.6mm]">
                    <span className="block truncate font-medium">{r.name}</span>
                    {r.sub && <span className="block truncate text-[6.5pt] text-slate-500">{r.sub}</span>}
                  </td>
                  {dates.map((d) => {
                    const v = r.cells[d] ?? "";
                    return (
                      <td key={d} className={`${cell} font-semibold ${CELL_TONE[v] ?? ""}`}>
                        {v}
                      </td>
                    );
                  })}
                  {r.totals.map((t, k) => (
                    <td key={k} className="border border-slate-300 px-[1mm] text-center font-semibold tabular-nums">
                      {t}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-[2mm] text-[7pt] text-slate-600">{legend}</p>

          {p === pages.length - 1 && (
            <footer className="mt-[10mm] flex items-end justify-between gap-[8mm] text-[8pt]">
              <span className="text-slate-500">Printed on {printed.format(new Date())}</span>
              <div className="flex gap-[14mm]">
                {signatures.map((s) => (
                  <div key={s} className="w-[48mm] text-center">
                    <div className="h-[10mm] border-b border-slate-700" />
                    <p className="mt-[1mm] font-semibold">{s}</p>
                    {s === "Principal" && school.principalName && <p className="text-[7pt] text-slate-500">{school.principalName}</p>}
                  </div>
                ))}
              </div>
            </footer>
          )}
        </article>
      ))}
    </div>
  );
}
