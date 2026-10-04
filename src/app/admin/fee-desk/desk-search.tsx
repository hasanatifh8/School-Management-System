"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Search, SearchX, X } from "lucide-react";
import { Avatar, selectClass } from "@/components/ui";
import { rupees } from "@/lib/fees-shared";
import { searchDeskStudents, type DeskStudent } from "./actions";

/**
 * Find a student: type any part of the name, ID, father's name, phone or roll
 * number (results as you type; ↑ ↓ Enter), or browse a class. Each result
 * shows what the student owes now.
 */
export function DeskSearch({
  selectedId,
  sections,
  recent,
}: {
  selectedId: string | null;
  sections: { id: string; label: string }[];
  recent: DeskStudent[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [section, setSection] = useState("");
  const [results, setResults] = useState<DeskStudent[] | null>(null);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const asked = useRef(0);

  // "/" focuses the search from anywhere on the desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !el.closest("input, textarea, select")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search as you type (a short pause first), or list the chosen class.
  useEffect(() => {
    if (!q.trim() && !section) {
      asked.current++; // drop any search still on its way
      return;
    }
    const ticket = ++asked.current;
    const t = setTimeout(
      () =>
        start(async () => {
          const found = await searchDeskStudents(q, section || null);
          if (ticket === asked.current) {
            setResults(found);
            setActive(0);
          }
        }),
      q.trim() ? 220 : 0,
    );
    return () => clearTimeout(t);
  }, [q, section]);

  // Nothing typed and no class chosen: show the recent students.
  const searching = !!q.trim() || !!section;
  const shown = searching ? results : null;
  const list = shown ?? recent;
  const open = (id: string) => router.replace(`/admin/fee-desk?s=${id}`, { scroll: false });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="space-y-2 border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            ref={input}
            autoFocus={!selectedId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, list.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && list[active]) {
                e.preventDefault();
                open(list[active].id);
              } else if (e.key === "Escape") setQ("");
            }}
            placeholder="Name, ID, father, phone or roll no."
            aria-label="Find a student"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-9 pr-9 text-base text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
          {pending ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />
          ) : (
            q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Browse a class" className={`${selectClass} !py-2 text-sm`}>
          <option value="">Browse a class…</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-eyebrow uppercase text-muted">
        {shown ? (
          `${shown.length} student${shown.length === 1 ? "" : "s"}${shown.length === 15 && !section ? "+ (type more to narrow)" : ""}`
        ) : (
          <>
            <Clock className="h-3.5 w-3.5" /> Recent
          </>
        )}
      </p>
      <ul role="listbox" aria-label="Students" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {list.length === 0 ? (
          <li className="flex flex-col items-center px-4 py-10 text-center text-sm text-muted">
            {shown ? (
              <>
                <SearchX className="mb-2 h-6 w-6 text-subtle" />
                No student matches. Try part of the name, the ID or a phone number.
              </>
            ) : (
              "Type to find a student. Press / to search from anywhere."
            )}
          </li>
        ) : (
          list.map((s, i) => {
            const selected = s.id === selectedId;
            return (
              <li key={s.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => open(s.id)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                    selected ? "bg-accent-soft ring-1 ring-inset ring-accent-line" : i === active && shown ? "bg-surface-2" : "hover:bg-surface-2"
                  }`}
                >
                  <Avatar name={s.name} src={s.photoUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{s.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[s.className, s.roll != null ? `Roll ${s.roll}` : null, s.father].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={`shrink-0 text-right text-xs font-semibold tabular-nums ${s.dueNow ? "text-danger" : "text-success"}`}>
                    {s.dueNow ? rupees(s.dueNow) : "Clear"}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
