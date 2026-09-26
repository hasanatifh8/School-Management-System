"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Loader2, RotateCcw, Search, X } from "lucide-react";
import { buttonVariants, inputClass, selectClass } from "@/components/ui";

type Update = Record<string, string | null>;

const ToolbarContext = createContext<{ update: (u: Update) => void; pending: boolean } | null>(null);

function useToolbar() {
  const ctx = useContext(ToolbarContext);
  if (!ctx) throw new Error("Use inside <ListToolbar>");
  return ctx;
}

/**
 * Search and filters for a list page. Every change updates the URL right away
 * (search is debounced), so the server re-renders the filtered list.
 */
export function ListToolbar({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Update) {
    const next = new URLSearchParams(params);
    next.delete("page"); // a new search or filter starts from the first page
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <ToolbarContext.Provider value={{ update, pending }}>
      <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
        {children}
        {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Updating" />}
      </div>
    </ToolbarContext.Provider>
  );
}

/** Search box that searches as you type and has an × to clear it. */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const { update } = useToolbar();
  const urlValue = useSearchParams().get("q") ?? "";
  const [value, setValue] = useState(urlValue);
  const [lastUrlValue, setLastUrlValue] = useState(urlValue);
  // What this box last put in the URL, so its own updates don't overwrite newer typing.
  const [sent, setSent] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow the URL only when it changes elsewhere (e.g. "Reset").
  if (urlValue !== lastUrlValue) {
    setLastUrlValue(urlValue);
    if (urlValue !== sent) setValue(urlValue);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function send(next: string) {
    const q = next.trim() ? next : "";
    setSent(q);
    update({ q: q || null });
  }

  function change(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => send(next), 300);
  }

  function clear() {
    clearTimeout(timer.current);
    setValue("");
    send("");
  }

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && clear()}
        placeholder={placeholder}
        aria-label="Search"
        className={`${inputClass} !w-full !py-2 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export type FilterOption = { value: string; label: string };

/** A dropdown filter bound to one URL parameter. `resets` are cleared when it changes. */
export function FilterSelect({
  name,
  label,
  options,
  resets = [],
  disabled,
}: {
  name: string;
  label: string;
  options: FilterOption[];
  resets?: string[];
  disabled?: boolean;
}) {
  const { update } = useToolbar();
  const value = useSearchParams().get(name) ?? "";
  const active = Boolean(value);
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => update({ [name]: e.target.value || null, ...Object.fromEntries(resets.map((r) => [r, null])) })}
      className={`${selectClass} !w-auto min-w-36 !py-2 ${active ? "!border-indigo-300 !bg-indigo-50/60 font-medium text-indigo-900" : ""}`}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Clears the given filters (keeps the Active/Removed tab). Hidden when none are set. */
export function ResetFilters({ keys }: { keys: string[] }) {
  const { update } = useToolbar();
  const params = useSearchParams();
  if (!keys.some((k) => params.get(k))) return null;
  return (
    <button
      type="button"
      onClick={() => update(Object.fromEntries(keys.map((k) => [k, null])))}
      className={`${buttonVariants.ghost} !py-2`}
    >
      <RotateCcw className="h-4 w-4" />
      Reset
    </button>
  );
}
