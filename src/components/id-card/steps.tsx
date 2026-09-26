import Link from "next/link";
import { Check } from "lucide-react";

/** "1 Choose class → 2 Pick students → 3 Download or print", with finished steps as links. */
export function IdCardSteps({ steps, current }: { steps: { label: string; href?: string }[]; current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm print:hidden">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const body = (
          <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${active ? "bg-accent text-white" : done ? "bg-accent-soft text-accent-text hover:bg-accent-soft" : "bg-surface-3 text-muted"}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-surface/20" : done ? "bg-accent-soft" : "bg-surface"}`}>
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {s.label}
          </span>
        );
        return (
          <li key={s.label} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-4 bg-line-strong" />}
            {done && s.href ? <Link href={s.href}>{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}
