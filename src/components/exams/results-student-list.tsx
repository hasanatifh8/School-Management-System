"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Search, Trophy, X } from "lucide-react";
import { Avatar, Badge, inputClass, selectClass } from "@/components/ui";

export type StudentResult = {
  id: string;
  name: string;
  rollNumber: number | null;
  studentCode: string;
  photoUrl: string | null;
  obtained: string;
  max: number;
  percent: number | null;
  grade: string;
  rank: number | null;
  result: "Pass" | "Fail" | "Incomplete";
  failed: string[];
};

type Filter = "all" | "Pass" | "Fail" | "Incomplete";
type Sort = "roll" | "rank" | "name";

/** Section results as a list: find a student, then open their report card. */
export function ResultsStudentList({ students, cardHref }: { students: StudentResult[]; cardHref: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("roll");

  const counts = useMemo(
    () => ({
      all: students.length,
      Pass: students.filter((s) => s.result === "Pass").length,
      Fail: students.filter((s) => s.result === "Fail").length,
      Incomplete: students.filter((s) => s.result === "Incomplete").length,
    }),
    [students],
  );

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = students.filter(
      (s) =>
        (filter === "all" || s.result === filter) &&
        words.every((w) => s.name.toLowerCase().includes(w) || s.studentCode.toLowerCase().includes(w) || String(s.rollNumber ?? "") === w),
    );
    const byRoll = (a: StudentResult, b: StudentResult) => (a.rollNumber ?? 1e9) - (b.rollNumber ?? 1e9) || a.name.localeCompare(b.name);
    return list.sort(
      sort === "rank" ? (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || byRoll(a, b) : sort === "name" ? (a, b) => a.name.localeCompare(b.name) : byRoll,
    );
  }, [students, q, filter, sort]);

  const chips: { key: Filter; label: string; tone: string }[] = [
    { key: "all", label: "All", tone: "bg-slate-900 text-white" },
    { key: "Pass", label: "Pass", tone: "bg-emerald-600 text-white" },
    { key: "Fail", label: "Fail", tone: "bg-rose-600 text-white" },
    { key: "Incomplete", label: "Incomplete", tone: "bg-slate-600 text-white" },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, roll no. or ID" aria-label="Search students" className={`${inputClass} !py-2 !pl-9 !pr-9`} />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by result">
          {chips
            .filter((c) => c.key === "all" || counts[c.key])
            .map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={filter === c.key}
                onClick={() => setFilter(c.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${filter === c.key ? c.tone : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {c.label} <span className="tabular-nums opacity-75">{counts[c.key]}</span>
              </button>
            ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500 lg:ml-auto">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClass} !w-36 !py-1.5`}>
            <option value="roll">Roll number</option>
            <option value="rank">Rank</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500">No students match. Try a different name or filter.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((s) => (
            <li key={s.id}>
              <Link href={`${cardHref}${s.id}`} className="group flex items-center gap-4 px-6 py-3 transition hover:bg-indigo-50/40 focus-visible:bg-indigo-50/60 focus-visible:outline-none">
                <span className="w-8 text-right text-sm tabular-nums text-slate-400">{s.rollNumber ?? "—"}</span>
                <Avatar name={s.name} src={s.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 group-hover:text-indigo-700">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    <span className="font-mono">{s.studentCode}</span>
                    {s.failed.length > 0 && s.result === "Fail" && <span className="text-rose-600"> · Below pass in {s.failed.join(", ")}</span>}
                  </p>
                </div>
                <div className="hidden w-40 sm:block">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="tabular-nums text-slate-700">
                      {s.obtained}
                      <span className="text-slate-400">/{s.max}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">{s.percent == null ? "—" : `${s.percent.toFixed(1)}%`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${s.result === "Fail" ? "bg-rose-500" : s.result === "Pass" ? "bg-emerald-500" : "bg-slate-300"}`}
                      style={{ width: `${Math.min(100, s.percent ?? 0)}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 text-center text-sm font-semibold text-slate-700">{s.grade}</span>
                <span className="hidden w-16 text-center md:block">
                  {s.rank ? (
                    <span className={`inline-flex items-center gap-1 text-sm tabular-nums ${s.rank <= 3 ? "font-semibold text-amber-600" : "text-slate-600"}`}>
                      {s.rank <= 3 && <Trophy className="h-3.5 w-3.5" />}#{s.rank}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </span>
                <span className="w-24 text-right">
                  <Badge tone={s.result === "Pass" ? "green" : s.result === "Fail" ? "red" : "slate"}>{s.result}</Badge>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
        Showing {shown.length} of {students.length} · Click a student to open their report card
        {shown.length > 0 && (
          <>
            {" · "}
            <button type="button" onClick={() => router.push(`${cardHref}${shown[0].id}`)} className="font-medium text-indigo-600 hover:text-indigo-500">
              Start with {shown[0].name.split(" ")[0]}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
