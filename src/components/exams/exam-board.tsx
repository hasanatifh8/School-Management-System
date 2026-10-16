"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  FileBarChart,
  FilePen,
  Hourglass,
  Layers,
  Printer,
  Search,
  SearchX,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge, EmptyState, IconTile, inputClass, selectClass, type IconTone } from "@/components/ui";
import { dateSpan } from "@/lib/exams-shared";
import type { ExamSummary } from "@/lib/exams";

type Timing = "upcoming" | "ongoing" | "completed" | "unscheduled";
type ResultsState = "published" | "partly" | "awaiting";

const TIMING: Record<Timing, { label: string; tone: "sky" | "amber" | "green" | "slate" }> = {
  upcoming: { label: "Upcoming", tone: "sky" },
  ongoing: { label: "Ongoing", tone: "amber" },
  completed: { label: "Completed", tone: "green" },
  unscheduled: { label: "No dates yet", tone: "slate" },
};

const PAGE = 12;

function timingOf(e: ExamSummary, today: string): Timing {
  if (!e.dates.length) return "unscheduled";
  const sorted = [...e.dates].sort();
  if (sorted[0] > today) return "upcoming";
  if (sorted.at(-1)! < today) return "completed";
  return "ongoing";
}

function resultsOf(e: ExamSummary): ResultsState {
  if (e.sections.length && e.resultsPublished >= e.sections.length) return "published";
  return e.resultsPublished > 0 ? "partly" : "awaiting";
}

/**
 * The session's exams (or teachers' tests) as cards, with KPI cards that filter
 * them, a search and a sort. `mode` "results" opens Marks & results and shows
 * how far results are published; "exams" opens the timetable and can print it.
 */
export function ExamBoard({
  exams,
  today,
  mode,
  openBase,
  printBase,
  showAuthor = false,
}: {
  exams: ExamSummary[];
  today: string;
  mode: "exams" | "results";
  /** Card link: `${openBase}${exam.id}`. */
  openBase: string;
  /** Print link: `${printBase}${exam.id}/print?from=list`. */
  printBase?: string;
  showAuthor?: boolean;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "date" | "name">("recent");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => exams.map((e) => ({ e, timing: timingOf(e, today), results: resultsOf(e), first: [...e.dates].sort()[0] ?? "" })), [exams, today]);

  const kpis: { key: string; label: string; icon: LucideIcon; tone: IconTone; count: number; detail: string }[] =
    mode === "exams"
      ? [
          { key: "all", label: "All", icon: ClipboardList, tone: "indigo", count: rows.length, detail: "This session" },
          { key: "upcoming", label: "Upcoming", icon: CalendarClock, tone: "sky", count: rows.filter((r) => r.timing === "upcoming").length, detail: "Not started" },
          { key: "ongoing", label: "Ongoing", icon: Hourglass, tone: "amber", count: rows.filter((r) => r.timing === "ongoing").length, detail: "Papers running" },
          { key: "completed", label: "Completed", icon: CalendarCheck2, tone: "emerald", count: rows.filter((r) => r.timing === "completed").length, detail: "All papers done" },
          ...(showAuthor
            ? []
            : [{ key: "draft", label: "Drafts", icon: FilePen, tone: "slate" as IconTone, count: rows.filter((r) => r.e.kind === "EXAM" && !r.e.published).length, detail: "Not shared yet" }]),
        ]
      : [
          { key: "all", label: "All", icon: ClipboardList, tone: "indigo", count: rows.length, detail: "This session" },
          { key: "awaiting", label: "Awaiting results", icon: CircleDashed, tone: "amber", count: rows.filter((r) => r.results === "awaiting").length, detail: "None published" },
          { key: "partly", label: "Partly published", icon: Layers, tone: "sky", count: rows.filter((r) => r.results === "partly").length, detail: "Some sections" },
          { key: "published", label: "Results out", icon: FileBarChart, tone: "emerald", count: rows.filter((r) => r.results === "published").length, detail: "Every section" },
        ];

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter(({ e, timing, results }) => {
      if (filter !== "all" && !(filter === "draft" ? e.kind === "EXAM" && !e.published : mode === "exams" ? timing === filter : results === filter)) return false;
      const text = `${e.name} ${e.sections.join(" ")} ${e.createdBy}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    if (sort === "name") list.sort((a, b) => a.e.name.localeCompare(b.e.name));
    // By exam date: undated ones last.
    else if (sort === "date") list.sort((a, b) => (a.first || "9999").localeCompare(b.first || "9999"));
    return list;
  }, [rows, q, filter, sort, mode]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const visible = shown.slice((current - 1) * PAGE, current * PAGE);
  const reset = () => setPage(1);

  return (
    <div className="space-y-5">
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${kpis.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {kpis.map((k) => {
          const active = filter === k.key;
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(active && k.key !== "all" ? "all" : k.key);
                reset();
              }}
              className={`group rounded-2xl border bg-surface p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift ${
                active ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted">{k.label}</p>
                <IconTile icon={k.icon} tone={k.tone} size="sm" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-fg">{k.count}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{k.detail}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              reset();
            }}
            placeholder={showAuthor ? "Search test, class or teacher" : "Search exam or class, e.g. Half-yearly, Class 6"}
            aria-label="Search"
            className={`${inputClass} !pl-9 !pr-9`}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg-2">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted sm:ml-auto">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={`${selectClass} !w-40`}>
            <option value="recent">Recently created</option>
            <option value="date">Exam date</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface shadow-card">
          <EmptyState icon={SearchX} title="Nothing matches" description="Try another search, or pick All." />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ e, timing, results }) => (
            <ExamCard key={e.id} exam={e} timing={timing} results={results} mode={mode} href={`${openBase}${e.id}`} printHref={printBase && `${printBase}${e.id}/print?from=list`} showAuthor={showAuthor} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-xs text-muted">
          <span className="tabular-nums">
            {(current - 1) * PAGE + 1}–{Math.min(current * PAGE, shown.length)} of {shown.length}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className={pagerBtn}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-14 text-center tabular-nums">
              {current} / {pages}
            </span>
            <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Next page" className={pagerBtn}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

const pagerBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40";

function ExamCard({
  exam: e,
  timing,
  results,
  mode,
  href,
  printHref,
  showAuthor,
}: {
  exam: ExamSummary;
  timing: Timing;
  results: ResultsState;
  mode: "exams" | "results";
  href: string;
  printHref?: string;
  showAuthor: boolean;
}) {
  const shown = e.sections.slice(0, 4);
  const pct = e.sections.length ? Math.round((e.resultsPublished / e.sections.length) * 100) : 0;
  const t = TIMING[timing];
  return (
    <li className="group relative flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lift">
      <div className="flex items-start gap-3">
        <IconTile icon={e.kind === "EXAM" ? ClipboardList : CalendarDays} tone={e.kind === "EXAM" ? "indigo" : "emerald"} />
        <div className="min-w-0 flex-1 pr-8">
          {/* The whole card opens the exam; print stays its own button above the link. */}
          <Link href={href} className="font-semibold text-fg after:absolute after:inset-0 after:rounded-2xl group-hover:text-accent-text">
            <span className="line-clamp-2">{e.name}</span>
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">
            {e.papers} paper{e.papers === 1 ? "" : "s"}
            {showAuthor && ` · by ${e.createdBy}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={t.tone} dot>
          {t.label}
        </Badge>
        {e.kind === "EXAM" &&
          (e.published ? (
            <Badge tone="green">Published</Badge>
          ) : (
            <Badge tone="amber">Draft</Badge>
          ))}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-fg-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
        {dateSpan(e.dates)}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {shown.map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
        {e.sections.length > shown.length && <Badge>+{e.sections.length - shown.length} more</Badge>}
        {!e.sections.length && <span className="text-xs text-subtle">No classes</span>}
      </div>

      {mode === "results" && (
        <div className="mt-auto pt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Results published</span>
            <span className={`font-medium tabular-nums ${results === "published" ? "text-success" : "text-fg-2"}`}>
              {e.resultsPublished} / {e.sections.length} section{e.sections.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={`h-full rounded-full ${results === "published" ? "bg-success-solid" : "bg-accent"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3 z-10 flex items-center">
        {printHref && (
          <Link href={printHref} title="Print timetable" aria-label={`Print ${e.name} timetable`} className="rounded-lg p-2 text-subtle transition hover:bg-surface-3 hover:text-fg-2">
            <Printer className="h-4 w-4" />
          </Link>
        )}
        {!printHref && <ChevronRight className="m-2 h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />}
      </div>
    </li>
  );
}
