"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download, FileDown } from "lucide-react";
import { Button, Modal, checkboxClass } from "@/components/ui";
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
  const [isOpen, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaults));

  const groups = [...new Set(fields.map((f) => f.group))];

  function open() {
    // Start from the admin's last choice, if the browser remembers one.
    const saved = savedFields(kind)?.filter((k) => fields.some((f) => f.key === k));
    setSelected(new Set(saved?.length ? saved : defaults));
    setOpen(true);
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
    setOpen(false);
  }

  return (
    <>
      <Button variant="secondary" icon={FileDown} onClick={open} title={`Export ${noun} to Excel`}>
        <span className="hidden sm:inline">Export</span>
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setOpen(false)}
        size="lg"
        title={`Export ${noun} to Excel`}
        description={`${count.toLocaleString("en-IN")} ${noun} (the current search, filters and tab). Choose the columns to include.`}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted">{selected.size} column(s) selected</span>
            <Button icon={Download} onClick={download} disabled={!selected.size || !count}>
              Download Excel
            </Button>
          </div>
        }
      >
        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(fields.map((f) => f.key)))}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(defaults))}>
              Default columns
            </Button>
          </div>

          {groups.map((group) => (
            <fieldset key={group}>
              <legend className="mb-2 text-eyebrow uppercase text-muted">{group}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {fields
                  .filter((f) => f.group === group)
                  .map((f) => (
                    <label
                      key={f.key}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-fg-2 transition hover:bg-surface-2 has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft has-[:checked]:text-fg"
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
      </Modal>
    </>
  );
}
