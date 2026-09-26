"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { selectClass } from "@/components/ui";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type Paging } from "@/lib/pagination";

/** Page numbers to show: always the first and last, and two either side of the current one. */
function pageList(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const n of nums) {
    const prev = out[out.length - 1];
    // A gap of one page shows that page instead of "…".
    if (typeof prev === "number" && n - prev === 2) out.push(prev + 1);
    else if (typeof prev === "number" && n - prev > 2) out.push("gap");
    out.push(n);
  }
  return out;
}

/**
 * "Showing 26–50 of 312", a rows-per-page choice and page links. Keeps the
 * list's search and filters in the URL. Hidden when everything fits on one page
 * at the smallest size.
 */
export function Pagination({ paging, noun = "rows" }: { paging: Paging; noun?: string }) {
  const { page, pages, perPage, total } = paging;
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (total <= PAGE_SIZES[0]) return null;

  const href = (changes: Record<string, number | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null) next.delete(key);
      else next.set(key, String(value));
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const pageHref = (n: number) => href({ page: n === 1 ? null : n });
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  const arrow =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40";

  return (
    <nav
      aria-label="Pagination"
      aria-busy={pending}
      className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          Showing <span className="font-medium text-slate-900">{first.toLocaleString("en-IN")}–{last.toLocaleString("en-IN")}</span> of{" "}
          <span className="font-medium text-slate-900">{total.toLocaleString("en-IN")}</span> {noun}
        </span>
        <label className="flex items-center gap-2 text-slate-500">
          <span className="sr-only sm:not-sr-only">Per page</span>
          <select
            value={perPage}
            onChange={(e) => {
              const size = Number(e.target.value);
              startTransition(() => router.push(href({ perPage: size === DEFAULT_PAGE_SIZE ? null : size, page: null })));
            }}
            className={`${selectClass} !w-20 !py-1.5`}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Loading" />}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <Link href={pageHref(page - 1)} aria-disabled={page === 1} aria-label="Previous page" className={arrow}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {pageList(page, pages).map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={pageHref(n)}
                aria-current={n === page ? "page" : undefined}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 tabular-nums transition ${
                  n === page
                    ? "bg-indigo-600 font-semibold text-white shadow-sm shadow-indigo-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {n}
              </Link>
            ),
          )}
          <Link href={pageHref(page + 1)} aria-disabled={page === pages} aria-label="Next page" className={arrow}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </nav>
  );
}
