"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, IdCard, Search } from "lucide-react";
import { Avatar, Badge, buttonVariants, checkboxClass, inputClass } from "@/components/ui";

type Student = { id: string; name: string; code: string; roll: number | null; photoUrl: string | null; missing: string[] };

/** Step 2: tick the students whose cards to make, then generate. */
export function StudentPicker({
  students,
  generatePath,
  profilePath,
  max,
}: {
  students: Student[];
  /** e.g. "/admin/id-cards/generate" — selected ids are added as ?ids=. */
  generatePath: string;
  profilePath: string;
  max: number;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? students.filter((s) => `${s.name} ${s.code} ${s.roll ?? ""}`.toLowerCase().includes(q)) : students;
  }, [students, query]);
  const allShown = shown.length > 0 && shown.every((s) => selected.has(s.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of shown) {
        if (allShown) next.delete(s.id);
        else next.add(s.id);
      }
      return next;
    });
  const ids = students.filter((s) => selected.has(s.id)).map((s) => s.id);
  const tooMany = ids.length > max;
  const withoutPhoto = students.filter((s) => s.missing.includes("photo")).length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={allShown} onChange={toggleShown} className={checkboxClass} aria-label="Select all" />
          Select all{query ? " shown" : ""}
        </label>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID or roll"
            aria-label="Search students"
            className={`${inputClass} !py-2 pl-9`}
          />
        </div>
      </div>

      {withoutPhoto > 0 && (
        <p className="border-b border-slate-100 bg-amber-50/60 px-4 py-2 text-xs text-amber-800 sm:px-6">
          {withoutPhoto} student{withoutPhoto === 1 ? " has" : "s have"} no photo. Their card shows a placeholder until a photo is added.
        </p>
      )}

      <ul className="divide-y divide-slate-100">
        {shown.map((s) => (
          <li key={s.id} className={`flex items-center gap-3 px-4 py-2.5 sm:px-6 ${selected.has(s.id) ? "bg-indigo-50/40" : ""}`}>
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className={checkboxClass}
              aria-label={`Select ${s.name}`}
            />
            <span className="w-7 shrink-0 text-right font-mono text-xs text-slate-400">{s.roll ?? "—"}</span>
            <button type="button" onClick={() => toggle(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar name={s.name} src={s.photoUrl} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{s.name}</span>
                <span className="block font-mono text-[11px] text-slate-400">{s.code}</span>
              </span>
            </button>
            <span className="hidden flex-wrap justify-end gap-1 sm:flex">
              {s.missing.map((m) => (
                <Link key={m} href={`${profilePath}/${s.id}`} title="Open the profile to add it">
                  <Badge tone="amber">No {m}</Badge>
                </Link>
              ))}
            </span>
            <Link href={`${generatePath}?ids=${s.id}`} className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Card
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="px-6 py-10 text-center text-sm text-slate-500">No students match “{query}”.</li>}
      </ul>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <p className="text-sm text-slate-600">
          {ids.length ? (
            <>
              <strong className="text-slate-900">{ids.length}</strong> selected
              {tooMany && <span className="ml-2 text-rose-600">Choose at most {max} at a time.</span>}
            </>
          ) : (
            "Tick the students whose ID cards you want."
          )}
        </p>
        {ids.length > 0 && !tooMany ? (
          <Link href={`${generatePath}?ids=${ids.join(",")}`} className={buttonVariants.primary}>
            <IdCard className="h-4 w-4" />
            Generate {ids.length} ID card{ids.length === 1 ? "" : "s"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`${buttonVariants.primary} pointer-events-none opacity-50`} aria-disabled>
            <IdCard className="h-4 w-4" />
            Generate ID cards
          </span>
        )}
      </div>
    </div>
  );
}
