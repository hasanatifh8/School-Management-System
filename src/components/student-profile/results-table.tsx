"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search, SearchX } from "lucide-react";
import { Badge, Card, cx, inputClass, selectClass, Table, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import type { ResultStatus } from "@/lib/exams-shared";

export type ResultSummary = {
  id: string;
  name: string;
  kind: "EXAM" | "TEST";
  session: string;
  sectionLabel: string;
  dates: string;
  obtained: number;
  max: number;
  percent: number;
  grade: string;
  rank: number | null;
  outOf: number;
  result: ResultStatus | null;
  href: string;
};

const RESULT_TONE: Record<ResultStatus, "green" | "red" | "amber" | "slate"> = { Pass: "green", Fail: "red", Absent: "amber", Incomplete: "slate", Awaited: "slate" };

/**
 * Every published result of the student in one table, newest first, with a
 * search and filters by type and session. A row opens that exam's report card.
 */
export function ResultsTable({ rows, current }: { rows: ResultSummary[]; current: string }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [session, setSession] = useState("");
  const sessions = useMemo(() => [...new Set(rows.map((r) => r.session))], [rows]);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!kind || r.kind === kind) && (!session || r.session === session));

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
        <h2 className="mr-auto font-semibold text-fg">
          Results <span className="font-normal text-muted">· {rows.length}</span>
        </h2>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exams" aria-label="Search exams" className={`${inputClass} !h-9 w-48 !py-1.5 pl-9`} />
        </label>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type" className={`${selectClass} !h-9 !w-36 !py-1.5`}>
          <option value="">All types</option>
          <option value="EXAM">Exams</option>
          <option value="TEST">Class tests</option>
        </select>
        {sessions.length > 1 && (
          <select value={session} onChange={(e) => setSession(e.target.value)} aria-label="Session" className={`${selectClass} !h-9 !w-36 !py-1.5`}>
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-muted">
          <SearchX className="h-4 w-4" /> No results match.
        </p>
      ) : (
        <Table>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Exam</th>
              <th className={thClass}>Class</th>
              <th className={`${thClass} text-right`}>Marks</th>
              <th className={`${thClass} text-right`}>%</th>
              <th className={thClass}>Grade</th>
              <th className={thClass}>Rank</th>
              <th className={thClass}>Result</th>
              <th className={thClass}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            {shown.map((r) => {
              const on = r.id === current;
              return (
                <tr key={r.id} className={cx("transition", on ? "bg-accent-soft/50" : "hover:bg-surface-2")}>
                  <td className={tdClass}>
                    <Link href={r.href} scroll={false} aria-current={on ? "true" : undefined} className="font-medium text-fg hover:text-accent-text hover:underline">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Badge tone={r.kind === "EXAM" ? "indigo" : "sky"}>{r.kind === "EXAM" ? "Exam" : "Class test"}</Badge>
                      {r.dates && <span>{r.dates}</span>}
                    </p>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-muted`}>
                    {r.sectionLabel}
                    <span className="block text-xs">{r.session}</span>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{r.max ? `${r.obtained} / ${r.max}` : "—"}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums text-fg`}>{r.max && r.result !== "Absent" ? `${r.percent.toFixed(1)}%` : "—"}</td>
                  <td className={`${tdClass} font-semibold text-fg`}>{r.grade}</td>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums text-muted`}>{r.rank ? `${r.rank} of ${r.outOf}` : "—"}</td>
                  <td className={tdClass}>{r.result ? <Badge tone={RESULT_TONE[r.result]}>{r.result}</Badge> : <span className="text-subtle">—</span>}</td>
                  <td className={tdClass}>
                    <Link href={r.href} scroll={false} aria-label={`Open ${r.name}`} className={cx("inline-flex rounded-md p-1.5", on ? "text-accent-text" : "text-subtle hover:bg-surface-3 hover:text-accent-text")}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
