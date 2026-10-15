import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, Printer } from "lucide-react";
import { Badge, ButtonLink, IconTile } from "@/components/ui";
import { dateSpan } from "@/lib/exams-shared";
import type { ExamSummary } from "@/lib/exams";

/** Exams or tests as rows with their classes, dates and status. */
export function ExamList({
  exams,
  href,
  printHref,
  showAuthor = false,
  showResults = false,
  openLabel,
}: {
  exams: ExamSummary[];
  href: (exam: ExamSummary) => string;
  printHref?: (exam: ExamSummary) => string;
  showAuthor?: boolean;
  /** Show how many sections have published results, instead of the dates. */
  showResults?: boolean;
  /** Open each exam only with a button of this label, e.g. "View results"; otherwise the whole row opens it. */
  openLabel?: string;
}) {
  return (
    <ul className="divide-y divide-line">
      {exams.map((e) => {
        const shown = e.sections.slice(0, 4);
        return (
          <li key={e.id} className={`group flex flex-wrap items-center gap-4 px-4 py-4 sm:px-6 ${openLabel ? "" : "transition hover:bg-surface-2"}`}>
            <IconTile icon={e.kind === "EXAM" ? ClipboardList : CalendarDays} tone={e.kind === "EXAM" ? "indigo" : "emerald"} />
            <Info href={openLabel ? undefined : href(e)}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-fg">{e.name}</p>
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
              <p className="mt-1 text-sm text-muted">
                {dateSpan(e.dates)} · {e.papers} paper{e.papers === 1 ? "" : "s"}
                {showAuthor && ` · by ${e.createdBy}`}
                {showResults && ` · results published for ${e.resultsPublished} of ${e.sections.length} section${e.sections.length === 1 ? "" : "s"}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {shown.map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
                {e.sections.length > shown.length && <Badge>+{e.sections.length - shown.length} more</Badge>}
              </div>
            </Info>
            <div className="flex items-center gap-1">
              {printHref && (
                <Link
                  href={printHref(e)}
                  title="Print timetable"
                  aria-label={`Print ${e.name}`}
                  className="rounded-lg p-2 text-subtle transition hover:bg-surface-3 hover:text-fg-2"
                >
                  <Printer className="h-4 w-4" />
                </Link>
              )}
              {openLabel ? (
                <ButtonLink href={href(e)} variant="secondary" size="sm">
                  {openLabel}
                </ButtonLink>
              ) : (
                <Link href={href(e)} aria-label={`Open ${e.name}`} className="rounded-lg p-2 text-subtle transition hover:bg-surface-3 hover:text-fg-2">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The exam's details: a link to it, or plain text when only its button opens it. */
function Info({ href, children }: { href?: string; children: ReactNode }) {
  return href ? (
    <Link href={href} className="min-w-0 flex-1">
      {children}
    </Link>
  ) : (
    <div className="min-w-0 flex-1">{children}</div>
  );
}
