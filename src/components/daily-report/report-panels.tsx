"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronRight, MessageCircle, Search } from "lucide-react";
import { Avatar, Badge, cx, inputClass } from "@/components/ui";
import { MODE_LABELS, rupees, type PaymentModeKey } from "@/lib/fees-shared";

/* ───────────────────────── Shared bits ───────────────────────── */

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <span className="relative block min-w-48 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${inputClass} !py-2 !pl-9`}
      />
    </span>
  );
}

function Chip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
        on ? "bg-accent-soft text-accent-text ring-accent-line" : "bg-surface text-fg-2 ring-line hover:bg-surface-2",
      )}
    >
      {children}
      {count != null && <span className={cx("rounded-full px-1.5 tabular-nums", on ? "bg-accent/15" : "bg-surface-3")}>{count}</span>}
    </button>
  );
}

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const matches = (q: string, ...fields: (string | null | undefined)[]) => words(q).every((w) => fields.some((f) => f?.toLowerCase().includes(w)));

/** WhatsApp chat link for an Indian mobile number, with a message ready. */
function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `https://wa.me/91${digits}?text=${encodeURIComponent(text)}` : null;
}

/* ───────────────────────── Class attendance ───────────────────────── */

export type BoardClass = {
  sectionId: string;
  label: string;
  teacher: { name: string; phone: string | null } | null;
  strength: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  marked: number;
  status: "taken" | "not-taken" | "holiday";
  holiday: string | null;
  percent: number | null;
  markedBy: string | null;
  markedAt: string | null;
};

const SEGMENTS = [
  { key: "present", label: "Present", className: "bg-emerald-500" },
  { key: "late", label: "Late", className: "bg-orange-400" },
  { key: "halfDay", label: "Half day", className: "bg-yellow-400" },
  { key: "absent", label: "Absent", className: "bg-rose-500" },
  { key: "leave", label: "Leave", className: "bg-violet-500" },
] as const;

/**
 * Every class's attendance for the day: a stacked bar each (hover for numbers),
 * filters for classes not taken or below 75%, search, sort, and a WhatsApp
 * reminder to the class teacher where it isn't taken.
 */
export function ClassBoard({
  classes,
  date,
  dayLabel,
  closed,
  live,
}: {
  classes: BoardClass[];
  date: string;
  dayLabel: string;
  closed: boolean;
  live: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "not-taken" | "low" | "taken">(
    closed ? "all" : classes.some((c) => c.status === "not-taken" && c.strength) ? "not-taken" : "all",
  );
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"class" | "low" | "absent">("class");
  const rows = classes.filter((c) => c.strength > 0);
  const counts = {
    all: rows.length,
    "not-taken": rows.filter((c) => c.status === "not-taken").length,
    low: rows.filter((c) => c.percent != null && c.percent < 75).length,
    taken: rows.filter((c) => c.status === "taken").length,
  };
  const shown = useMemo(() => {
    const list = rows.filter(
      (c) => (filter === "all" || (filter === "low" ? c.percent != null && c.percent < 75 : c.status === filter)) && matches(q, c.label, c.teacher?.name),
    );
    if (sort === "low") return [...list].sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101));
    if (sort === "absent") return [...list].sort((a, b) => b.absent - a.absent);
    return list;
  }, [rows, filter, q, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
        <Chip on={filter === "all"} onClick={() => setFilter("all")} count={counts.all}>
          All classes
        </Chip>
        {!closed && (
          <Chip on={filter === "not-taken"} onClick={() => setFilter("not-taken")} count={counts["not-taken"]}>
            Not taken
          </Chip>
        )}
        <Chip on={filter === "low"} onClick={() => setFilter("low")} count={counts.low}>
          Below 75%
        </Chip>
        <Chip on={filter === "taken"} onClick={() => setFilter("taken")} count={counts.taken}>
          Taken
        </Chip>
        <span className="flex-1" />
        <label className="inline-flex items-center gap-1.5 text-xs text-muted">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort classes"
            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-fg-2"
          >
            <option value="class">Class order</option>
            <option value="low">Lowest attendance first</option>
            <option value="absent">Most absent first</option>
          </select>
        </label>
      </div>
      <div className="border-b border-line px-4 py-3 sm:px-6">
        <SearchBox value={q} onChange={setQ} placeholder="Search a class or class teacher" />
      </div>

      {/* Legend: identity never by colour alone. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-muted sm:px-6">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cx("h-2.5 w-2.5 rounded-sm", s.className)} aria-hidden /> {s.label}
          </span>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted">{filter === "not-taken" ? "Every class has taken attendance. 🎉" : "No class matches."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((c) => {
            const remind =
              c.status === "not-taken" && live && !closed && c.teacher?.phone
                ? waLink(c.teacher.phone, `Hello ${c.teacher.name.split(" ")[0]}, a reminder to take ${c.label} attendance for ${dayLabel}. Thank you.`)
                : null;
            return (
              <li key={c.sectionId} className="grid items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:px-6">
                <div className="min-w-0">
                  <Link href={`/admin/attendance/${c.sectionId}?date=${date}`} className="block truncate font-semibold text-fg hover:text-accent-text">
                    {c.label}
                  </Link>
                  <span className="block truncate text-xs text-muted">{c.teacher?.name ?? "No class teacher"}</span>
                </div>

                <div className="min-w-0">
                  {c.status === "taken" ? (
                    <>
                      <div
                        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-3"
                        role="img"
                        aria-label={`${c.present} present, ${c.absent} absent, ${c.leave} on leave of ${c.strength}`}
                      >
                        {SEGMENTS.map((s) => {
                          const n = s.key === "present" ? c.present - c.late - c.halfDay : c[s.key];
                          return n > 0 ? (
                            <span
                              key={s.key}
                              title={`${s.label}: ${n}`}
                              className={cx("h-full first:rounded-l-full last:rounded-r-full", s.className)}
                              style={{ width: `${(n / c.strength) * 100}%` }}
                            />
                          ) : null;
                        })}
                      </div>
                      <p className="mt-1 text-xs tabular-nums text-muted">
                        {c.present} present · <span className={c.absent ? "font-medium text-danger" : ""}>{c.absent} absent</span>
                        {c.leave ? ` · ${c.leave} leave` : ""} of {c.strength}
                        {c.markedBy && (
                          <span className="text-subtle">
                            {" "}
                            · by {c.markedBy.replace(/ \(.*\)$/, "")}
                            {c.markedAt ? ` at ${c.markedAt}` : ""}
                          </span>
                        )}
                      </p>
                    </>
                  ) : c.status === "holiday" ? (
                    <p className="text-sm text-muted">Class holiday{c.holiday ? `: ${c.holiday}` : ""}</p>
                  ) : (
                    <p className="text-sm text-muted">{closed ? "No school" : `Not taken${live ? " yet" : ""} · ${c.strength} students`}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  {c.status === "taken" ? (
                    <span
                      className={cx(
                        "min-w-14 text-right text-lg font-bold tabular-nums",
                        c.percent == null ? "text-subtle" : c.percent >= 90 ? "text-success" : c.percent >= 75 ? "text-warning" : "text-danger",
                      )}
                    >
                      {c.percent == null ? "—" : `${Math.round(c.percent)}%`}
                    </span>
                  ) : c.status === "holiday" ? (
                    <Badge tone="sky">Holiday</Badge>
                  ) : closed ? (
                    <Badge>Closed</Badge>
                  ) : (
                    <>
                      {remind && (
                        <a
                          href={remind}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Remind ${c.teacher!.name} on WhatsApp`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-success hover:bg-success-soft"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Remind
                        </a>
                      )}
                      <Badge tone="amber" dot>
                        Not taken
                      </Badge>
                    </>
                  )}
                  <Link
                    href={`/admin/attendance/${c.sectionId}?date=${date}`}
                    aria-label={`Open ${c.label} attendance`}
                    className="rounded-lg p-1 text-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────── People ───────────────────────── */

export type PersonRow = {
  id: string;
  name: string;
  sub: string;
  href: string;
  photoUrl: string | null;
  tag: string;
  tone: "red" | "amber" | "indigo" | "slate" | "sky" | "green";
  phone?: string | null;
};
export type PeopleGroup = { key: string; label: string; people: PersonRow[]; empty: string; action?: { href: string; label: string } };

/** Tabs of people for the day (absent students, staff away…), each searchable. */
export function PeopleTabs({ groups }: { groups: PeopleGroup[] }) {
  // Open on the first tab with someone in it.
  const [active, setActive] = useState((groups.find((g) => g.people.length) ?? groups[0])?.key);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(12);
  const group = groups.find((g) => g.key === active) ?? groups[0];
  const list = group.people.filter((p) => matches(q, p.name, p.sub, p.tag));
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-6" role="tablist">
        {groups.map((g) => (
          <Chip
            key={g.key}
            on={g.key === group.key}
            onClick={() => {
              setActive(g.key);
              setLimit(12);
            }}
            count={g.people.length}
          >
            {g.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
        <SearchBox value={q} onChange={setQ} placeholder="Search by name or class" />
        {group.action && group.people.length > 0 && (
          <Link
            href={group.action.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-success ring-1 ring-inset ring-success-line hover:brightness-95"
          >
            <MessageCircle className="h-3.5 w-3.5" /> {group.action.label}
          </Link>
        )}
      </div>
      {list.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted">{group.people.length ? "No one matches." : group.empty}</p>
      ) : (
        <>
          <ul className="grid sm:grid-cols-2">
            {list.slice(0, limit).map((p) => (
              <li key={p.id} className="border-b border-line sm:odd:border-r">
                <Link href={p.href} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-2 sm:px-6">
                  <Avatar name={p.name} src={p.photoUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.sub}</span>
                  </span>
                  <Badge tone={p.tone}>{p.tag}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + 24)}
              className="w-full border-t border-line px-4 py-2.5 text-sm font-medium text-accent-text hover:bg-surface-2"
            >
              Show more ({list.length - limit} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Fees ───────────────────────── */

const MODE_COLORS: Record<string, string> = {
  CASH: "bg-emerald-500",
  UPI: "bg-indigo-500",
  CARD: "bg-sky-500",
  CHEQUE: "bg-amber-500",
  BANK_TRANSFER: "bg-teal-500",
  OTHER: "bg-slate-400",
};

export type FeesData = {
  total: number;
  count: number;
  receipts: {
    id: string;
    number: string;
    studentId: string | null;
    studentName: string;
    className: string | null;
    total: number;
    mode: string;
    collectedBy: string;
    createdAt: string;
    reference: string | null;
  }[];
  byMode: { mode: string; amount: number }[];
  byCollector: { name: string; amount: number; count: number }[];
};

/** The day's fee collection: by payment mode (stacked bar + legend), by collector, and every receipt. */
export function FeesPanel({ fees }: { fees: FeesData }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  const list = fees.receipts.filter((r) => (!mode || r.mode === mode) && matches(q, r.studentName, r.number, r.className, r.collectedBy));
  if (!fees.count) return <p className="px-6 py-10 text-center text-sm text-muted">No fees collected on this day.</p>;
  return (
    <div>
      <div className="space-y-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label="Fees by payment mode">
          {fees.byMode.map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => setMode(mode === m.mode ? null : m.mode)}
              title={`${MODE_LABELS[m.mode as PaymentModeKey] ?? m.mode}: ${rupees(m.amount)}`}
              className={cx(
                "h-full transition first:rounded-l-full last:rounded-r-full hover:opacity-80",
                MODE_COLORS[m.mode] ?? "bg-slate-400",
                mode && mode !== m.mode && "opacity-30",
              )}
              style={{ width: `${(m.amount / fees.total) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {fees.byMode.map((m) => (
            <button
              key={m.mode}
              type="button"
              aria-pressed={mode === m.mode}
              onClick={() => setMode(mode === m.mode ? null : m.mode)}
              className={cx(
                "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs ring-1 ring-inset transition",
                mode === m.mode ? "bg-accent-soft ring-accent-line" : "ring-line hover:bg-surface-2",
              )}
            >
              <span className={cx("h-2.5 w-2.5 rounded-sm", MODE_COLORS[m.mode] ?? "bg-slate-400")} aria-hidden />
              <span className="text-fg-2">{MODE_LABELS[m.mode as PaymentModeKey] ?? m.mode}</span>
              <span className="font-semibold tabular-nums text-fg">{rupees(m.amount)}</span>
              <span className="tabular-nums text-subtle">{Math.round((m.amount / fees.total) * 100)}%</span>
            </button>
          ))}
        </div>
        {fees.byCollector.length > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span className="font-medium text-fg-2">Collected by</span>
            {fees.byCollector.map((c) => (
              <span key={c.name}>
                {c.name.replace(/ \(.*\)$/, "")} · <span className="font-semibold tabular-nums text-fg">{rupees(c.amount)}</span> ({c.count})
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="border-b border-line px-4 py-3 sm:px-6">
        <SearchBox value={q} onChange={setQ} placeholder="Search student, receipt no. or collector" />
      </div>
      {list.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted">No receipt matches.</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {list.slice(0, limit).map((r) => (
              <li key={r.id}>
                <Link href={`/admin/fees/receipts/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-2 sm:px-6">
                  <span className={cx("h-8 w-1.5 shrink-0 rounded-full", MODE_COLORS[r.mode] ?? "bg-slate-400")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{r.studentName}</span>
                    <span className="block truncate text-xs text-muted">
                      {[r.className, `#${r.number}`, MODE_LABELS[r.mode as PaymentModeKey] ?? r.mode, r.createdAt].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-fg">{rupees(r.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + 20)}
              className="w-full border-t border-line px-4 py-2.5 text-sm font-medium text-accent-text hover:bg-surface-2"
            >
              Show more ({list.length - limit} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Activity ───────────────────────── */

export type ActivityRow = { id: string; action: string; actor: string | null; category: string | null; createdAt: string };

/** Everything logged on the day, newest first, filterable by area. */
export function ActivityFeed({ items }: { items: ActivityRow[] }) {
  const [cat, setCat] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.category) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const list = items.filter((i) => !cat || i.category === cat);
  if (!items.length) return <p className="px-6 py-10 text-center text-sm text-muted">Nothing was logged on this day.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-6">
        <Chip on={!cat} onClick={() => setCat(null)} count={items.length}>
          Everything
        </Chip>
        {cats.map(([c, n]) => (
          <Chip key={c} on={cat === c} onClick={() => setCat(c)} count={n}>
            {c}
          </Chip>
        ))}
      </div>
      <ol className="relative ml-6 border-l-2 border-dashed border-line py-2 pl-5 sm:ml-8">
        {list.slice(0, limit).map((i) => (
          <li key={i.id} className="relative py-2 pr-4">
            <span aria-hidden className="absolute -left-[27px] top-3.5 h-3 w-3 rounded-full bg-accent ring-4 ring-surface" />
            <p className="text-sm text-fg">{i.action}</p>
            <p className="text-xs text-muted">
              {i.createdAt}
              {i.actor && ` · ${i.actor}`}
              {i.category && ` · ${i.category}`}
            </p>
          </li>
        ))}
      </ol>
      {list.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 30)}
          className="w-full border-t border-line px-4 py-2.5 text-sm font-medium text-accent-text hover:bg-surface-2"
        >
          Show more ({list.length - limit} more)
        </button>
      )}
      <div className="border-t border-line px-4 py-2.5 text-right sm:px-6">
        <Link href="/admin/activity" className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline">
          Full activity log <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
