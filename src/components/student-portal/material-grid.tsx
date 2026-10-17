import Link from "next/link";
import { BookOpenText, CalendarClock, Download, ExternalLink, Eye, Search, X } from "lucide-react";
import { subjectTone } from "@/components/student-portal/ui";
import { Badge, EmptyState, cx, inputClass } from "@/components/ui";
import { formatISO, isoDate, shortDate, todayISO } from "@/lib/attendance-shared";
import { INLINE_TYPES } from "@/lib/documents";
import type { MaterialRow } from "@/lib/materials";
import { KIND_META, MATERIAL_KINDS } from "@/lib/materials-shared";
import type { readMaterialFilters } from "@/components/materials/material-list";

const PAGE = 18;

/**
 * A student's study material as colourful cards: subject chips (each subject
 * its own colour), type chips and a search, all in the URL (?subject=, ?kind=, ?q=, ?page=).
 */
export function StudentMaterialGrid({ rows, filters, page: pageParam }: { rows: MaterialRow[]; filters: ReturnType<typeof readMaterialFilters>; page: number }) {
  const subjects = [...new Map(rows.filter((r) => r.subject).map((r) => [r.subject!.id, r.subject!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(
    (r) =>
      (!filters.kind || r.kind === filters.kind) &&
      (!filters.subject || r.subjectId === filters.subject) &&
      words.every((w) => `${r.title} ${r.description ?? ""} ${r.subject?.name ?? ""}`.toLowerCase().includes(w)),
  );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const page = Math.min(Math.max(1, pageParam), pages);
  const href = (changes: Partial<Record<"kind" | "subject" | "q" | "page", string | null>>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ kind: filters.kind ?? "", subject: filters.subject, q: filters.q, ...changes })) if (v) p.set(k, v);
    return `/student/materials${p.size ? `?${p}` : ""}`;
  };
  const today = todayISO();
  const chip = "rounded-full px-3 py-1.5 text-xs font-semibold transition";

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <form action="/student/materials" className="flex flex-wrap items-center gap-2">
          {filters.kind && <input type="hidden" name="kind" value={filters.kind} />}
          {filters.subject && <input type="hidden" name="subject" value={filters.subject} />}
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input name="q" defaultValue={filters.q} placeholder="Search notes, chapters, topics…" className={`${inputClass} !rounded-full !pl-9`} />
          </label>
          {(filters.q || filters.subject || filters.kind) && (
            <Link href="/student/materials" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
              <X className="h-4 w-4" /> Clear
            </Link>
          )}
        </form>
        {subjects.length > 0 && (
          <nav aria-label="Subjects" className="flex flex-wrap gap-1.5">
            <Link href={href({ subject: null, page: null })} className={cx(chip, !filters.subject ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong")}>
              All subjects
            </Link>
            {subjects.map(([id, name]) => (
              <Link key={id} href={href({ subject: id, page: null })} className={cx(chip, subjectTone(name).chip, filters.subject === id ? "ring-2 ring-offset-1 ring-offset-surface ring-current" : "opacity-80 hover:opacity-100")}>
                {name}
              </Link>
            ))}
          </nav>
        )}
        <nav aria-label="Type" className="flex flex-wrap gap-1.5">
          {MATERIAL_KINDS.filter((k) => rows.some((r) => r.kind === k)).map((k) => (
            <Link key={k} href={href({ kind: filters.kind === k ? null : k, page: null })} className={cx(chip, filters.kind === k ? "bg-accent text-white" : "bg-surface-2 text-fg-2 ring-1 ring-line hover:bg-surface-3")}>
              {KIND_META[k].plural} <span className="tabular-nums opacity-70">{rows.filter((r) => r.kind === k).length}</span>
            </Link>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface shadow-card">
          <EmptyState icon={BookOpenText} title={rows.length ? "Nothing matches" : "Nothing posted yet"} description={rows.length ? "Try another subject, type or search." : "Notes, assignments and test papers from your teachers appear here."} />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.slice((page - 1) * PAGE, page * PAGE).map((m) => {
            const tone = subjectTone(m.subject?.name);
            const due = m.dueDate ? isoDate(m.dueDate) : null;
            const inline = m.mimeType ? INLINE_TYPES.has(m.mimeType) : false;
            return (
              <li key={m.id} className={cx("flex flex-col rounded-3xl bg-gradient-to-br to-surface p-5 ring-1 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift", tone.soft, tone.ring)}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cx("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone.chip)}>{m.subject?.name ?? "General"}</span>
                  <Badge tone={KIND_META[m.kind].badge}>{KIND_META[m.kind].label}</Badge>
                </div>
                <h3 className="mt-3 text-base font-semibold text-fg">{m.title}</h3>
                {m.description && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-fg-2">{m.description}</p>}
                {due && (
                  <p className={cx("mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", due < today ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200")}>
                    <CalendarClock className="h-3.5 w-3.5" /> {due < today ? "Was due" : "Due"} {formatISO(due, shortDate)}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">
                  {m.uploadedBy.replace(/ \((admin|teacher)\)$/, "")} · {formatISO(isoDate(m.createdAt), shortDate)}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {m.fileId && inline && (
                    <a href={`/api/materials/${m.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-accent transition hover:bg-accent-hover">
                      <Eye className="h-3.5 w-3.5" /> Open
                    </a>
                  )}
                  {m.fileId && (
                    <a href={`/api/materials/${m.id}?download`} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg-2 ring-1 ring-line transition hover:bg-surface-2">
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  )}
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg-2 ring-1 ring-line transition hover:bg-surface-2">
                      <ExternalLink className="h-3.5 w-3.5" /> Open link
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n === 1 ? null : String(n) })} aria-current={n === page ? "page" : undefined} className={cx("flex h-9 w-9 items-center justify-center rounded-full font-medium", n === page ? "bg-accent text-white" : "bg-surface text-fg-2 ring-1 ring-line hover:bg-surface-2")}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
