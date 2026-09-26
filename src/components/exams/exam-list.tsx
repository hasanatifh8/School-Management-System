import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, Printer } from "lucide-react";
import { Badge, IconTile } from "@/components/ui";
import { dateSpan } from "@/lib/exams-shared";
import type { ExamSummary } from "@/lib/exams";

/** Exams or tests as rows with their classes, dates and status. */
export function ExamList({
  exams,
  href,
  printHref,
  showAuthor = false,
}: {
  exams: ExamSummary[];
  href: (exam: ExamSummary) => string;
  printHref: (exam: ExamSummary) => string;
  showAuthor?: boolean;
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {exams.map((e) => {
        const shown = e.sections.slice(0, 4);
        return (
          <li key={e.id} className="flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-slate-50/70">
            <IconTile icon={e.kind === "EXAM" ? ClipboardList : CalendarDays} tone={e.kind === "EXAM" ? "indigo" : "emerald"} />
            <Link href={href(e)} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-slate-900">{e.name}</p>
                {e.kind === "EXAM" &&
                  (e.published ? (
                    <Badge tone="green" dot>
                      Published
                    </Badge>
                  ) : (
                    <Badge tone="amber" dot>
                      Draft
                    </Badge>
                  ))}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {dateSpan(e.dates)} · {e.papers} paper{e.papers === 1 ? "" : "s"}
                {showAuthor && ` · by ${e.createdBy}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {shown.map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
                {e.sections.length > shown.length && <Badge>+{e.sections.length - shown.length} more</Badge>}
              </div>
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href={printHref(e)}
                title="Print timetable"
                aria-label={`Print ${e.name}`}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Printer className="h-4 w-4" />
              </Link>
              <Link href={href(e)} aria-label={`Open ${e.name}`} className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
