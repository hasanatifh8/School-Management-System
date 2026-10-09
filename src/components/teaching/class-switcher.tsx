import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { cx } from "@/components/ui";
import { sectionLabel } from "@/lib/names";

/**
 * For a class teacher of several sections: which class the "My class" pages
 * show, and a chip to switch to each of the others (then back to `here`).
 */
export function ClassSwitcher({
  sections,
  current,
  here,
}: {
  sections: { id: string; name: string; class: { name: string } }[];
  current: string | undefined;
  here: string;
}) {
  if (sections.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Your classes">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        <ArrowLeftRight className="h-3.5 w-3.5" /> Your classes
      </span>
      {sections.map((s) => (
        <Link
          key={s.id}
          href={`/teacher/switch-class?id=${s.id}&to=${encodeURIComponent(here)}`}
          prefetch={false}
          aria-current={s.id === current ? "true" : undefined}
          className={cx(
            "rounded-full px-3 py-1 text-sm font-medium transition",
            s.id === current ? "bg-accent text-accent-fg shadow-card" : "bg-surface-3 text-fg-2 hover:bg-line-strong",
          )}
        >
          {sectionLabel(s)}
        </Link>
      ))}
    </div>
  );
}
