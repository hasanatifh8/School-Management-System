"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, CircleMinus, CirclePlus, Search, Trash2, X } from "lucide-react";
import { Badge, EmptyState, SegmentedControl, inputClass, useConfirm, useToast } from "@/components/ui";
import { rupees } from "@/lib/fees-shared";
import { removeOneTimeItem } from "@/app/admin/payroll/actions";

export type OneTimeItemRow = {
  id: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amount: number;
  note: string | null;
  person: string;
  profileHref: string | null;
  /** Already on a paid slip (can't be removed here). */
  onSlip: boolean;
};

const PAGE = 10;

/** A month's one-time earnings and deductions, searchable and filterable, with remove for those not yet paid. */
export function OneTimeItems({ items, compact = false }: { items: OneTimeItemRow[]; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "EARNING" | "DEDUCTION">("all");
  const [page, setPage] = useState(1);
  const confirm = useConfirm();
  const toast = useToast();

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => (kind === "all" || it.kind === kind) && words.every((w) => `${it.name} ${it.person} ${it.note ?? ""}`.toLowerCase().includes(w)));
  }, [items, q, kind]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const visible = shown.slice((current - 1) * PAGE, current * PAGE);
  const total = (k: "EARNING" | "DEDUCTION") => items.filter((i) => i.kind === k).reduce((n, i) => n + i.amount, 0);

  if (!items.length)
    return <EmptyState compact icon={CalendarPlus} title="No one-time items" description="Bonuses, arrears or advances for this month only show up here." />;

  return (
    <div>
      {!compact && (
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search item or person"
              aria-label="Search one-time items"
              className={`${inputClass} !py-2 !pl-9 !pr-9`}
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg-2">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <SegmentedControl
            label="Type"
            size="sm"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: `All (${items.length})` },
              { value: "EARNING", label: "Earnings", icon: CirclePlus },
              { value: "DEDUCTION", label: "Deductions", icon: CircleMinus },
            ]}
          />
          <p className="text-xs text-muted sm:ml-auto">
            <span className="text-success">+{rupees(total("EARNING"))}</span> · <span className="text-danger">−{rupees(total("DEDUCTION"))}</span>
          </p>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted">Nothing matches.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${it.kind === "EARNING" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
              >
                {it.kind === "EARNING" ? <CirclePlus className="h-4 w-4" /> : <CircleMinus className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">
                  {it.name}
                  {!compact && (
                    <span className="font-normal text-muted">
                      {" "}
                      ·{" "}
                      {it.profileHref ? (
                        <Link href={it.profileHref} className="hover:text-accent-text">
                          {it.person}
                        </Link>
                      ) : (
                        it.person
                      )}
                    </span>
                  )}
                </span>
                {it.note && <span className="block truncate text-xs text-muted">{it.note}</span>}
              </span>
              <span className={`font-semibold tabular-nums ${it.kind === "DEDUCTION" ? "text-danger" : "text-success"}`}>
                {it.kind === "DEDUCTION" ? "−" : "+"}
                {rupees(it.amount)}
              </span>
              {it.onSlip ? (
                <Badge tone="green">On the slip</Badge>
              ) : (
                <>
                  <Badge tone="amber">Added when paid</Badge>
                  <button
                    type="button"
                    aria-label={`Remove ${it.name} for ${it.person}`}
                    title="Remove"
                    onClick={async () => {
                      if (!(await confirm({ title: `Remove ${it.name} for ${it.person}?`, tone: "danger", confirmLabel: "Remove" }))) return;
                      const res = await removeOneTimeItem(it.id);
                      toast(res.error ? { title: res.error, tone: "error" } : { title: res.message ?? "Removed." });
                    }}
                    className="rounded-md p-1.5 text-danger transition hover:bg-danger-soft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
          <span className="tabular-nums">
            {(current - 1) * PAGE + 1}–{Math.min(current * PAGE, shown.length)} of {shown.length} items
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
