"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  SearchCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Badge, SuccessState, buttonVariants, useConfirm } from "@/components/ui";
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
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg shadow-accent">
          {n}
        </span>
        <h2 className="font-semibold text-fg">{title}</h2>
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
  const confirm = useConfirm();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "import" ? "import" : "preview";
    if (
      mode === "import" &&
      !(await confirm({ title: `Import ${preview?.valid} ${noun.many}?`, message: "Rows with errors are skipped.", confirmLabel: "Import" }))
    )
      return;
    const formData = new FormData(form, submitter);
    setSubmitting(mode);
    setCheckedFile(file);
    startTransition(() => formAction(formData));
  }

  if (state.done) {
    const { created, skipped, codes } = state.done;
    return (
      <section className="rounded-2xl border border-line bg-surface shadow-card">
        <SuccessState
          title={`${created} ${created === 1 ? noun.one : noun.many} added`}
          description={
            <>
              {skipped ? `${skipped} row(s) with errors were skipped. ` : ""}IDs {codes[0]}
              {codes.length > 1 && <> to {codes[codes.length - 1]}</>} were generated.
            </>
          }
          action={
            <>
              <Link href={listHref} className={buttonVariants.primary}>
                View {noun.many}
              </Link>
              <button type="button" onClick={onRestart} className={buttonVariants.secondary}>
                Upload another file
              </button>
            </>
          }
        />
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Step n={1} title="Download the template">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl text-sm text-fg-2">
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
          <label className="relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-accent-line hover:bg-accent-soft/40 has-[:focus-visible]:border-accent">
            <FileSpreadsheet className="h-8 w-8 text-success" />
            {file ? (
              <>
                <span className="text-sm font-medium text-fg">{file.name}</span>
                <span className="text-xs text-muted">Click to choose a different file</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-fg-2">Click to choose your Excel file</span>
                <span className="text-xs text-muted">.xlsx · up to 300 rows</span>
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
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger-line">
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
              <span className="text-muted">· {preview.fileName}</span>
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-xl border border-line">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Row</th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Details</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.rows.map((r) => (
                    <tr key={r.rowNumber} className={r.errors.length ? "bg-danger-soft/40" : ""}>
                      <td className="px-4 py-2.5 tabular-nums text-muted">{r.rowNumber}</td>
                      <td className="px-4 py-2.5 font-medium text-fg">{r.name}</td>
                      <td className="px-4 py-2.5 text-fg-2">{r.detail}</td>
                      <td className="px-4 py-2.5">
                        {r.errors.length ? (
                          <ul className="space-y-0.5 text-danger">
                            {r.errors.map((err) => (
                              <li key={err} className="flex items-start gap-1.5">
                                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {err}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-success">
                            <CircleCheck className="h-4 w-4" /> Ready
                          </span>
                        )}
                        {r.warnings.map((w) => (
                          <p key={w} className="mt-0.5 flex items-start gap-1.5 text-warning">
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
              <p className="text-sm text-muted">
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
