"use client";

import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";

const GAP = 24; // gap-6 between tabs

/**
 * A row of `StatusTab`s that never hides tabs off the edge: whatever doesn't
 * fit goes under "More". The open tab always stays in the row.
 */
export function OverflowTabs({ label, children }: { label: string; children: ReactNode }) {
  const items = Children.toArray(children);
  const wrap = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  // Indexes of the tabs shown in the row; null shows them all.
  const [shown, setShown] = useState<number[] | null>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const fit = () => {
      if (!wrap.current || !measure.current) return;
      const tabs = [...measure.current.children] as HTMLElement[];
      const widths = tabs.map((t) => t.offsetWidth);
      const avail = wrap.current.clientWidth;
      let next: number[] | null = null;
      if (widths.reduce((a, w) => a + w + GAP, -GAP) > avail) {
        const active = tabs.findIndex((t) => t.querySelector('[aria-current="page"]'));
        let used = (more.current?.offsetWidth ?? 80) + (active >= 0 ? widths[active] + GAP : 0);
        next = [];
        for (let i = 0; i < widths.length; i++) {
          if (i === active) continue;
          if (used + widths[i] + GAP > avail) break;
          next.push(i);
          used += widths[i] + GAP;
        }
        if (active >= 0) next = [...next, active].sort((a, b) => a - b);
      }
      setShown((prev) => (String(prev) === String(next) ? prev : next));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hidden = shown ? items.map((_, i) => i).filter((i) => !shown.includes(i)) : [];

  return (
    <div ref={wrap} className="relative -mb-px">
      {/* Every tab, laid out off-screen, to measure what fits. */}
      <div ref={measure} inert aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-6 text-sm font-medium">
        {items.map((item, i) => (
          <div key={i} className="shrink-0">
            {item}
          </div>
        ))}
      </div>

      <nav aria-label={label} className="flex items-end gap-6 overflow-hidden text-sm font-medium">
        {items.map((item, i) => (!shown || shown.includes(i) ? <div key={i} className="shrink-0">{item}</div> : null))}
        <button
          ref={more}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="true"
          className={cx(
            "flex shrink-0 items-center gap-1 rounded-t-md pb-3 pt-1 text-muted transition-colors hover:text-fg",
            // Kept in the layout (for measuring) but out of sight when everything fits.
            !hidden.length && "invisible absolute",
          )}
        >
          More
          <ChevronDown className={cx("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </nav>

      {open && hidden.length > 0 && (
        <div
          onClick={() => setOpen(false)}
          className="absolute right-0 top-full z-30 mt-1 min-w-48 rounded-xl border border-line bg-surface p-1.5 text-sm font-medium shadow-pop [&_a]:w-full [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2 [&_a]:after:hidden [&_a:hover]:bg-surface-2"
        >
          {hidden.map((i) => (
            <div key={i}>{items[i]}</div>
          ))}
        </div>
      )}
    </div>
  );
}
