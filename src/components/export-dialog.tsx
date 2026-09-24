"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Download, FileDown, X } from "lucide-react";
import { buttonVariants, checkboxClass } from "@/components/ui";
import { EXPORT_FIELDS, type ExportKind } from "@/lib/export/fields";

const storageKey = (kind: ExportKind) => `export-fields:${kind}`;

function savedFields(kind: ExportKind): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(kind));
    const keys = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string") : null;
  } catch {
    return null;
  }
}

/**
 * "Export" button + dialog: the admin ticks the columns to include and gets an
 * Excel file of the rows currently shown (same search, filters and tab).
 */
export function ExportDialog({ kind, count, noun }: { kind: ExportKind; count: number; noun: string }) {
  const fields = EXPORT_FIELDS[kind];
  const defaults = fields.filter((f) => f.default).map((f) => f.key);
  const params = useSearchParams();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaults));

  const groups = [...new Set(fields.map((f) => f.group))];

  function open() {
    // Start from the admin's last choice, if the browser remembers one.
    const saved = savedFields(kind)?.filter((k) => fields.some((f) => f.key === k));
    setSelected(new Set(saved?.length ? saved : defaults));
    dialog.current?.showModal();
  }

  function toggle(key: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    setSelected(next);
  }

  function download() {
    const keys = fields.filter((f) => selected.has(f.key)).map((f) => f.key);
    try {
      localStorage.setItem(storageKey(kind), JSON.stringify(keys));
    } catch {
      // Remembering the choice is only a convenience.
    }
    const query = new URLSearchParams(params);
    query.set("fields", keys.join(","));
    // A temporary link starts the file download without leaving the page.
    const link = document.createElement("a");
    link.href = `/api/export/${kind}?${query}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    dialog.current?.close();
  }

  return (
    <>
      <button type="button" onClick={open} className={buttonVariants.secondary}>
        <FileDown className="h-4 w-4" />
        Export
      </button>

      <dialog
        ref={dialog}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/40"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Export {noun} to Excel</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {count} {noun} (the current search, filters and tab). Choose the columns to include.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className={`${buttonVariants.ghost} !px-2 !py-1`} onClick={() => setSelected(new Set(fields.map((f) => f.key)))}>
              Select all
            </button>
            <button type="button" className={`${buttonVariants.ghost} !px-2 !py-1`} onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <button type="button" className={`${buttonVariants.ghost} !px-2 !py-1`} onClick={() => setSelected(new Set(defaults))}>
              Default columns
            </button>
          </div>

          {groups.map((group) => (
            <fieldset key={group}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{group}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {fields
                  .filter((f) => f.group === group)
                  .map((f) => (
                    <label
                      key={f.key}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/60"
                    >
                      <input
                        type="checkbox"
                        name="field"
                        value={f.key}
                        checked={selected.has(f.key)}
                        onChange={(e) => toggle(f.key, e.target.checked)}
                        className={checkboxClass}
                      />
                      {f.label}
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <span className="text-sm text-slate-500">{selected.size} column(s) selected</span>
          <button type="button" onClick={download} disabled={!selected.size || !count} className={buttonVariants.primary}>
            <Download className="h-4 w-4" />
            Download Excel
          </button>
        </div>
      </dialog>
    </>
  );
}
