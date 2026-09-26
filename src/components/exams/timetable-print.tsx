"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, GraduationCap, Loader2, Printer, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import {
  DEFAULT_PRINT_SETTINGS,
  dateSpan,
  formatDay,
  formatExamDate,
  timeRange,
  type PaperView,
  type PrintSettings,
} from "@/lib/exams-shared";

type Data = {
  school: { name: string; address: string | null; contact: string; logoUrl: string | null };
  exam: { name: string; kind: "EXAM" | "TEST"; session: string; instructions: string | null };
  classes: { id: string; label: string }[];
  papers: PaperView[];
  settings: PrintSettings;
};

const FONT = { small: "text-[8.5pt]", normal: "text-[10pt]", large: "text-[11.5pt]" } as const;

/** Print preview with layout options. `save` stores the options on the exam (omitted when read-only). */
export function TimetablePrint({ data, save, backHref }: { data: Data; save?: (settings: PrintSettings) => Promise<ActionState>; backHref: string }) {
  const [s, setS] = useState<PrintSettings>(data.settings);
  // With several classes, preview (and print) one class at a time unless "All classes" is chosen.
  const [only, setOnly] = useState<string>(data.classes.length > 1 ? data.classes[0].id : "all");
  const [result, setResult] = useState<ActionState>({});
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
    setResult({});
  };

  const { classes, papers } = data;
  const title = s.title.trim() || data.exam.name;
  const subtitle = s.subtitle.trim() || `${data.exam.kind === "EXAM" ? "Examination schedule" : "Test schedule"} · Session ${data.exam.session}`;
  const instructions = (data.exam.instructions ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const signatures = s.signatures.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 4);
  const forClass = (classId: string) => papers.filter((p) => p.classId === null || p.classId === classId);
  // Grid layout only helps when there is more than one class.
  const layout = classes.length > 1 ? s.layout : "class";

  const header = (classLabel?: string) => (
    <header className="mb-[4mm] border-b-2 border-slate-800 pb-[3mm] text-center">
      <div className="flex items-center justify-center gap-[4mm]">
        {s.showLogo &&
          (data.school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
            <img src={data.school.logoUrl} alt="" className="h-[16mm] w-[16mm] object-contain" />
          ) : (
            <span className="flex h-[14mm] w-[14mm] items-center justify-center rounded-full bg-slate-100">
              <GraduationCap className="h-[8mm] w-[8mm] text-slate-500" />
            </span>
          ))}
        <div>
          <p className="text-[15pt] font-bold uppercase leading-tight tracking-wide">{data.school.name}</p>
          {data.school.address && <p className="text-[8.5pt] text-slate-600">{data.school.address.replace(/\n/g, ", ")}</p>}
          {data.school.contact && <p className="text-[8.5pt] text-slate-600">{data.school.contact}</p>}
        </div>
      </div>
      <p className="mt-[3mm] text-[13pt] font-bold">{title}</p>
      <p className="text-[9pt] uppercase tracking-wider text-slate-600">{subtitle}</p>
      {classLabel && <p className="mt-[2mm] inline-block rounded border border-slate-800 px-[3mm] py-[0.5mm] text-[10.5pt] font-semibold">{classLabel}</p>}
    </header>
  );

  const footer = (
    <footer className="mt-[5mm] break-inside-avoid">
      {s.showInstructions && instructions.length > 0 && (
        <div className="mb-[6mm]">
          <p className="mb-[1mm] font-semibold uppercase tracking-wide">Instructions</p>
          <ol className="list-decimal space-y-[0.5mm] pl-[5mm]">
            {instructions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}
      {signatures.length > 0 && (
        <div className="flex justify-between gap-[8mm] pt-[10mm]">
          {signatures.map((label) => (
            <div key={label} className="min-w-[35mm] border-t border-slate-600 pt-[1mm] text-center text-[8.5pt] text-slate-600">
              {label}
            </div>
          ))}
        </div>
      )}
    </footer>
  );

  const cellPad = "border border-slate-400 px-[2mm] py-[1.5mm]";
  const classTable = (rows: PaperView[]) =>
    rows.length === 0 ? (
      <p className="py-[6mm] text-center italic text-slate-500">No papers scheduled.</p>
    ) : (
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left [print-color-adjust:exact]">
            <th className={`${cellPad} w-[8mm]`}>#</th>
            <th className={cellPad}>Date</th>
            {s.showDay && <th className={cellPad}>Day</th>}
            {s.showTime && <th className={cellPad}>Time</th>}
            <th className={cellPad}>Subject</th>
            {s.showMarks && <th className={`${cellPad} text-center`}>Max. marks</th>}
            {s.showRoom && <th className={cellPad}>Room</th>}
            {s.showNotes && <th className={cellPad}>Notes</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} className="break-inside-avoid">
              <td className={`${cellPad} text-slate-500`}>{i + 1}</td>
              <td className={`${cellPad} whitespace-nowrap font-medium`}>{formatExamDate(p.date)}</td>
              {s.showDay && <td className={cellPad}>{formatDay(p.date)}</td>}
              {s.showTime && <td className={`${cellPad} whitespace-nowrap`}>{timeRange(p.startTime, p.endTime)}</td>}
              <td className={`${cellPad} font-semibold`}>{p.subject}</td>
              {s.showMarks && <td className={`${cellPad} text-center tabular-nums`}>{p.maxMarks ?? "—"}</td>}
              {s.showRoom && <td className={cellPad}>{p.room ?? ""}</td>}
              {s.showNotes && <td className={cellPad}>{p.notes ?? ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    );

  // Grid: one row per date + time slot, one column per class.
  const slots = [...new Map(papers.map((p) => [`${p.date}|${p.startTime}|${p.endTime}`, p])).values()].map((p) => ({
    key: `${p.date}|${p.startTime}|${p.endTime}`,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
  }));
  const gridCell = (p: PaperView) => (
    <div key={p.id}>
      <p className="font-semibold">{p.subject}</p>
      {(s.showMarks && p.maxMarks != null) || (s.showRoom && p.room) ? (
        <p className="text-[0.85em] text-slate-600">{[s.showMarks && p.maxMarks != null && `MM ${p.maxMarks}`, s.showRoom && p.room].filter(Boolean).join(" · ")}</p>
      ) : null}
      {s.showNotes && p.notes && <p className="text-[0.85em] italic text-slate-600">{p.notes}</p>}
    </div>
  );
  const grid = (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-slate-100 text-left [print-color-adjust:exact]">
          <th className={cellPad}>Date{s.showTime ? " & time" : ""}</th>
          {classes.map((c) => (
            <th key={c.id} className={`${cellPad} text-center`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => {
          const inSlot = papers.filter((p) => `${p.date}|${p.startTime}|${p.endTime}` === slot.key);
          const common = inSlot.filter((p) => p.classId === null);
          return (
            <tr key={slot.key} className="break-inside-avoid">
              <td className={`${cellPad} whitespace-nowrap`}>
                <p className="font-semibold">{formatExamDate(slot.date)}</p>
                {s.showDay && <p className="text-[0.85em] text-slate-600">{formatDay(slot.date)}</p>}
                {s.showTime && <p className="text-[0.85em] text-slate-600">{timeRange(slot.startTime, slot.endTime)}</p>}
              </td>
              {common.length && inSlot.length === common.length ? (
                <td colSpan={classes.length} className={`${cellPad} text-center`}>
                  {common.map(gridCell)}
                </td>
              ) : (
                classes.map((c) => {
                  const here = inSlot.filter((p) => p.classId === null || p.classId === c.id);
                  return (
                    <td key={c.id} className={`${cellPad} text-center`}>
                      {here.length ? here.map(gridCell) : <span className="text-slate-400">—</span>}
                    </td>
                  );
                })
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const perClass = layout === "class" && classes.length > 1;
  const current = perClass && only !== "all" ? classes.findIndex((c) => c.id === only) : -1;
  const pages =
    layout === "grid"
      ? [{ key: "grid", body: grid, label: undefined as string | undefined }]
      : classes.length
        ? classes
            .filter((c) => !perClass || only === "all" || c.id === only)
            .map((c) => ({ key: c.id, body: classTable(forClass(c.id)), label: c.label as string | undefined }))
        : [{ key: "none", body: classTable([]), label: undefined }];
  const printLabel = !perClass ? "Print" : only === "all" ? `Print all ${classes.length} classes` : `Print ${classes[current]?.label ?? "class"}`;

  const check = (key: "showDay" | "showTime" | "showMarks" | "showRoom" | "showNotes" | "showInstructions" | "showLogo" | "pagePerClass", label: string) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={s[key]} onChange={(e) => set(key, e.target.checked)} className={checkboxClass} />
      {label}
    </label>
  );
  const fieldLabel = "mb-1.5 block text-xs font-medium text-slate-600";

  return (
    <div className="space-y-6">
      <style>{`@page { size: A4 ${s.orientation}; margin: 12mm; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className={buttonVariants.ghost}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <button type="button" onClick={() => window.print()} className={buttonVariants.primary}>
            <Printer className="h-4 w-4" />
            {printLabel}
          </button>
          <span className="text-sm text-slate-500">
            {papers.length} paper{papers.length === 1 ? "" : "s"} · {dateSpan(papers.map((p) => p.date))}
          </span>
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Print options</h2>
            <span className="text-xs text-slate-500">The preview below updates as you change them.</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={fieldLabel}>Layout</span>
              <select value={layout} onChange={(e) => set("layout", e.target.value as PrintSettings["layout"])} disabled={classes.length < 2} className={`${selectClass} !py-2`}>
                <option value="class">Separate sheet per class</option>
                <option value="grid">One chart, classes side by side</option>
              </select>
            </label>
            <label>
              <span className={fieldLabel}>Paper</span>
              <select value={s.orientation} onChange={(e) => set("orientation", e.target.value as PrintSettings["orientation"])} className={`${selectClass} !py-2`}>
                <option value="portrait">A4 portrait</option>
                <option value="landscape">A4 landscape</option>
              </select>
            </label>
            <label>
              <span className={fieldLabel}>Text size</span>
              <select value={s.fontSize} onChange={(e) => set("fontSize", e.target.value as PrintSettings["fontSize"])} className={`${selectClass} !py-2`}>
                <option value="small">Small</option>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label>
              <span className={fieldLabel}>Signature lines</span>
              <input value={s.signatures} maxLength={200} onChange={(e) => set("signatures", e.target.value)} placeholder="Comma separated, e.g. Class teacher, Principal" className={`${inputClass} !py-2`} />
            </label>
            <label className="sm:col-span-2">
              <span className={fieldLabel}>Heading</span>
              <input value={s.title} maxLength={200} onChange={(e) => set("title", e.target.value)} placeholder={data.exam.name} className={`${inputClass} !py-2`} />
            </label>
            <label className="sm:col-span-2">
              <span className={fieldLabel}>Sub-heading</span>
              <input
                value={s.subtitle}
                maxLength={200}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder={`${data.exam.kind === "EXAM" ? "Examination schedule" : "Test schedule"} · Session ${data.exam.session}`}
                className={`${inputClass} !py-2`}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {check("showDay", "Day")}
            {check("showTime", "Time")}
            {check("showMarks", "Max. marks")}
            {check("showRoom", "Room")}
            {check("showNotes", "Notes")}
            {check("showInstructions", "Instructions")}
            {check("showLogo", "School logo")}
            {perClass && only === "all" && check("pagePerClass", "Each class on a new page")}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            {save && (
              <button
                type="button"
                disabled={saving}
                onClick={() => startSaving(async () => setResult(await save(s)))}
                className={`${buttonVariants.secondary} !py-2`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save as default for this {data.exam.kind === "EXAM" ? "exam" : "test"}
              </button>
            )}
            <button type="button" onClick={() => setS({ ...DEFAULT_PRINT_SETTINGS })} className={`${buttonVariants.ghost} !py-2`}>
              <RotateCcw className="h-4 w-4" />
              Reset options
            </button>
            <FormMessage state={result} compact />
          </div>
        </section>
      </div>

      {perClass && (
        <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
          <button
            type="button"
            disabled={current <= 0}
            onClick={() => setOnly(classes[current - 1].id)}
            aria-label="Previous class"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-wrap justify-center gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Class to preview">
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={only === c.id}
                onClick={() => setOnly(c.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${only === c.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={only === "all"}
              onClick={() => setOnly("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${only === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              All classes ({classes.length})
            </button>
          </div>
          <button
            type="button"
            disabled={current < 0 || current >= classes.length - 1}
            onClick={() => setOnly(classes[current + 1].id)}
            aria-label="Next class"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Preview: looks like the printed sheet on screen, and is what prints. */}
      <div className={`mx-auto space-y-6 print:space-y-0 ${s.orientation === "portrait" ? "max-w-[210mm]" : "max-w-[297mm]"} print:max-w-none`}>
        {pages.map((page, i) => (
          <article
            key={page.key}
            className={`bg-white p-[12mm] text-slate-900 shadow-md ring-1 ring-slate-200 print:p-0 print:shadow-none print:ring-0 ${FONT[s.fontSize]} ${
              i > 0 && (layout === "grid" || s.pagePerClass) ? "print:break-before-page" : i > 0 ? "print:mt-[8mm]" : ""
            }`}
          >
            {(i === 0 || layout === "grid" || s.pagePerClass) && header(page.label)}
            {i > 0 && layout === "class" && !s.pagePerClass && page.label && (
              <p className="mb-[2mm] text-[11pt] font-semibold">{page.label}</p>
            )}
            {page.body}
            {(layout === "grid" || s.pagePerClass || i === pages.length - 1) && footer}
          </article>
        ))}
      </div>
    </div>
  );
}
