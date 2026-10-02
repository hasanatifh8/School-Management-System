"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, Eye, Printer, Search, SearchX, Trophy, X } from "lucide-react";
import { Avatar, Badge, EmptyState, PagedList, buttonVariants, inputClass, selectClass } from "@/components/ui";

const iconBtn = "rounded-lg p-2 text-subtle transition hover:bg-surface-3 hover:text-fg-2";

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
  result: "Pass" | "Fail" | "Incomplete" | "Absent";
  failed: string[];
};

type Filter = "all" | StudentResult["result"];
type Sort = "roll" | "rank" | "name";

/** Section results as a list: find a student, then view, print or download their report card. */
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
      Absent: students.filter((s) => s.result === "Absent").length,
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
    { key: "all", label: "All", tone: "bg-fg text-canvas" },
    { key: "Pass", label: "Pass", tone: "bg-success-solid text-white" },
    { key: "Fail", label: "Fail", tone: "bg-danger-solid text-white" },
    { key: "Incomplete", label: "Incomplete", tone: "bg-warning-solid text-white" },
    { key: "Absent", label: "Absent", tone: "bg-fg-2 text-canvas" },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line px-6 py-4 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, roll no. or ID" aria-label="Search students" className={`${inputClass} !pl-9 !pr-9`} />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg-2">
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
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${filter === c.key ? c.tone : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
              >
                {c.label} <span className="tabular-nums opacity-75">{counts[c.key]}</span>
              </button>
            ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted lg:ml-auto">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClass} !w-36`}>
            <option value="roll">Roll number</option>
            <option value="rank">Rank</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="No students match" description="Try a different name or filter." />
      ) : (
        // Keyed so a new search, filter or sort starts from the first page.
        <PagedList key={`${q}|${filter}|${sort}`} pageSize={15} noun="students">
          {shown.map((s) => (
            <li key={s.id} className="flex items-center gap-2 pr-4 transition hover:bg-surface-2 sm:pr-6">
              <Link href={`${cardHref}${s.id}`} className="group flex min-w-0 flex-1 items-center gap-4 py-3 pl-4 focus-visible:bg-accent-soft focus-visible:outline-none sm:pl-6">
                <span className="w-8 text-right text-sm tabular-nums text-subtle">{s.rollNumber ?? "—"}</span>
                <Avatar name={s.name} src={s.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg group-hover:text-accent-text">{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    <span className="font-mono">{s.studentCode}</span>
                    {s.failed.length > 0 && s.result === "Fail" && <span className="text-danger"> · Below pass in {s.failed.join(", ")}</span>}
                  </p>
                </div>
                <div className="hidden w-40 sm:block">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="tabular-nums text-fg-2">
                      {s.obtained}
                      <span className="text-subtle">/{s.max}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-fg">{s.percent == null ? "—" : `${s.percent.toFixed(1)}%`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={`h-full rounded-full ${s.result === "Fail" ? "bg-danger-solid" : s.result === "Pass" ? "bg-success-solid" : "bg-line-strong"}`}
                      style={{ width: `${Math.min(100, s.percent ?? 0)}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 text-center text-sm font-semibold text-fg-2">{s.grade}</span>
                <span className="hidden w-16 text-center md:block">
                  {s.rank ? (
                    <span className={`inline-flex items-center gap-1 text-sm tabular-nums ${s.rank <= 3 ? "font-semibold text-warning" : "text-fg-2"}`}>
                      {s.rank <= 3 && <Trophy className="h-3.5 w-3.5" />}#{s.rank}
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </span>
                <span className="w-24 text-right">
                  <Badge tone={s.result === "Pass" ? "green" : s.result === "Fail" || s.result === "Absent" ? "red" : "slate"}>{s.result}</Badge>
                </span>
              </Link>
              <Link href={`${cardHref}${s.id}`} className={`${buttonVariants.secondary} !px-3 !py-1.5 text-xs`}>
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">View result</span>
              </Link>
              <Link href={`${cardHref}${s.id}&do=print`} title={`Print ${s.name}'s report card`} aria-label={`Print ${s.name}'s report card`} className={iconBtn}>
                <Printer className="h-4 w-4" />
              </Link>
              <Link href={`${cardHref}${s.id}&do=pdf`} title={`Download ${s.name}'s report card (PDF)`} aria-label={`Download ${s.name}'s report card`} className={iconBtn}>
                <Download className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </PagedList>
      )}
      <p className="border-t border-line px-6 py-3 text-xs text-muted">
        Showing {shown.length} of {students.length} · Click a student to open their report card
        {shown.length > 0 && (
          <>
            {" · "}
            <button type="button" onClick={() => router.push(`${cardHref}${shown[0].id}`)} className="font-medium text-accent-text underline-offset-4 hover:underline">
              Start with {shown[0].name.split(" ")[0]}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
