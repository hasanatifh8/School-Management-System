"use client";

import { Children, cloneElement, isValidElement, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "./cx";

/**
 * Pages through rows already rendered on the server (lists inside a page, such
 * as the students of one class). For whole-page lists use <Pagination>, which
 * pages on the server via the URL.
 *
 * Rows on other pages stay mounted but `hidden`, so checkboxes and inputs in a
 * paged form are still submitted.
 */
function usePager(children: ReactNode, pageSize: number) {
  const all = Children.toArray(children);
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const [page, setPage] = useState(1);
  const current = Math.min(page, pages);
  const from = (current - 1) * pageSize;
  const rows = all.map((row, i) =>
    (i < from || i >= from + pageSize) && isValidElement<{ hidden?: boolean }>(row) ? cloneElement(row, { hidden: true }) : row,
  );
  return { rows, total: all.length, page: current, pages, setPage };
}

function Pager({
  page,
  pages,
  total,
  pageSize,
  noun,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  noun: string;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 active:scale-95 disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav aria-label={`${noun} pages`} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
      <span className="tabular-nums" aria-live="polite">
        {first}–{last} of {total} {noun}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-14 text-center tabular-nums">
          {page} / {pages}
        </span>
        <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

/** A paged <ul>. Children should be <li> elements. */
export function PagedList({
  children,
  pageSize = 10,
  noun = "items",
  className,
}: {
  children: ReactNode;
  pageSize?: number;
  noun?: string;
  className?: string;
}) {
  const p = usePager(children, pageSize);
  return (
    <>
      <ul className={cx("divide-y divide-line", className)}>{p.rows}</ul>
      <Pager {...p} pageSize={pageSize} noun={noun} onPage={p.setPage} />
    </>
  );
}

/** A paged table. `head` is the <tr> of header cells; children are body <tr> rows; `foot` stays on every page. */
export function PagedTable({
  head,
  foot,
  children,
  pageSize = 10,
  noun = "rows",
  tableClassName = "min-w-full text-sm",
  theadClassName,
  tbodyClassName,
}: {
  head: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  pageSize?: number;
  noun?: string;
  tableClassName?: string;
  theadClassName?: string;
  tbodyClassName?: string;
}) {
  const p = usePager(children, pageSize);
  return (
    <>
      <div className="relative overflow-x-auto">
        <table className={tableClassName}>
          <thead className={theadClassName}>{head}</thead>
          <tbody className={tbodyClassName}>{p.rows}</tbody>
          {foot && <tfoot>{foot}</tfoot>}
        </table>
      </div>
      <Pager {...p} pageSize={pageSize} noun={noun} onPage={p.setPage} />
    </>
  );
}
