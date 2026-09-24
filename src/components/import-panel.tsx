"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  PartyPopper,
  SearchCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Badge, buttonVariants } from "@/components/ui";
import type { ImportColumn } from "@/lib/import/columns";
import type { ImportState } from "@/lib/import/rows";

type Props = {
  noun: { one: string; many: string };
  columns: ImportColumn[];
  templateHref: string;
  listHref: string;
  action: (state: ImportState, formData: FormData) => Promise<ImportState>;
};

/** Bulk upload: download template → check file → review → import. */
export function ImportPanel(props: Props) {
  // Changing the key starts a fresh upload after a finished import.
  const [round, setRound] = useState(0);
  return <ImportFlow key={round} {...props} onRestart={() => setRound((r) => r + 1)} />;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {n}
        </span>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ImportFlow({ noun, columns, templateHref, listHref, action, onRestart }: Props & { onRestart: () => void }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [file, setFile] = useState<File | null>(null);
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<"preview" | "import" | null>(null);

  const preview = state.preview && checkedFile === file ? state.preview : undefined;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "import" ? "import" : "preview";
    if (mode === "import" && !window.confirm(`Import ${preview?.valid} ${noun.many}? Rows with errors are skipped.`)) return;
    const formData = new FormData(e.currentTarget, submitter);
    setSubmitting(mode);
    setCheckedFile(file);
    startTransition(() => formAction(formData));
  }

  if (state.done) {
    const { created, skipped, codes } = state.done;
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 text-xl font-semibold text-emerald-900">
          {created} {created === 1 ? noun.one : noun.many} added
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          {skipped ? `${skipped} row(s) with errors were skipped. ` : ""}IDs {codes[0]}
          {codes.length > 1 && <> to {codes[codes.length - 1]}</>} were generated.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={listHref} className={buttonVariants.primary}>
            View {noun.many}
          </Link>
          <button type="button" onClick={onRestart} className={buttonVariants.secondary}>
            Upload another file
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Step n={1} title="Download the template">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl text-sm text-slate-600">
            <p>Fill one {noun.one} per row. Columns marked * are required; the rest can be left blank and added later.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <Badge key={c.key} tone={c.required ? "indigo" : "slate"}>
                  {c.header}
                  {c.required && " *"}
                </Badge>
              ))}
            </div>
          </div>
          <a href={templateHref} className={buttonVariants.secondary} download>
            <Download className="h-4 w-4" />
            Download Excel template
          </a>
        </div>
      </Step>

      <form onSubmit={submit} className="space-y-6">
        <Step n={2} title="Upload the filled file">
          <label className="relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 has-[:focus-visible]:border-indigo-400">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
            {file ? (
              <>
                <span className="text-sm font-medium text-slate-800">{file.name}</span>
                <span className="text-xs text-slate-500">Click to choose a different file</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-slate-700">Click to choose your Excel file</span>
                <span className="text-xs text-slate-500">.xlsx · up to 300 rows</span>
              </>
            )}
            <input
              type="file"
              name="file"
              required
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {state.error && checkedFile === file && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {state.error}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button type="submit" name="mode" value="preview" disabled={!file || pending} className={buttonVariants.primary}>
              {pending && submitting === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
              {pending && submitting === "preview" ? "Checking…" : "Check file"}
            </button>
          </div>
        </Step>

        {preview && (
          <Step n={3} title="Review and import">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="green" dot>
                {preview.valid} ready
              </Badge>
              {preview.invalid > 0 && (
                <Badge tone="red" dot>
                  {preview.invalid} with errors (will be skipped)
                </Badge>
              )}
              {preview.rows.some((r) => r.warnings.length) && (
                <Badge tone="amber" dot>
                  {preview.rows.filter((r) => r.warnings.length).length} with warnings
                </Badge>
              )}
              <span className="text-slate-500">· {preview.fileName}</span>
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Row</th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Details</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r) => (
                    <tr key={r.rowNumber} className={r.errors.length ? "bg-rose-50/40" : ""}>
                      <td className="px-4 py-2.5 tabular-nums text-slate-500">{r.rowNumber}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.detail}</td>
                      <td className="px-4 py-2.5">
                        {r.errors.length ? (
                          <ul className="space-y-0.5 text-rose-700">
                            {r.errors.map((err) => (
                              <li key={err} className="flex items-start gap-1.5">
                                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {err}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <CircleCheck className="h-4 w-4" /> Ready
                          </span>
                        )}
                        {r.warnings.map((w) => (
                          <p key={w} className="mt-0.5 flex items-start gap-1.5 text-amber-700">
                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {w}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {preview.invalid > 0
                  ? "Fix the rows with errors in Excel and check again, or import the ready rows now."
                  : "Everything looks good."}
              </p>
              <button
                type="submit"
                name="mode"
                value="import"
                disabled={!preview.valid || pending}
                className={buttonVariants.primary}
              >
                {pending && submitting === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {pending && submitting === "import"
                  ? "Importing…"
                  : `Import ${preview.valid} ${preview.valid === 1 ? noun.one : noun.many}`}
              </button>
            </div>
          </Step>
        )}
      </form>
    </div>
  );
}
