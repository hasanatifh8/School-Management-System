import Link from "next/link";
import { ArrowRight, FileBarChart, Lock, PenLine } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { OverviewRow } from "@/lib/exam-marks";

/** Marks progress and result status for each section the viewer works with. */
export function MarksOverview({ rows, base, emptyText }: { rows: OverviewRow[]; base: string; emptyText?: string }) {
  return (
    <Card
      title="Marks & results"
      icon={PenLine}
      description="Enter marks section by section. The class teacher publishes the results once every mark is in."
      padded={false}
    >
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">{emptyText ?? "No sections to show."}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const pct = r.required ? Math.round((r.filled / r.required) * 100) : 0;
            const minePct = r.mine ? Math.round((r.mineFilled / r.mine) * 100) : 0;
            return (
              <li key={r.sectionId} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <div className="min-w-40 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{r.label}</p>
                    {r.students === 0 ? (
                      <Badge>No students</Badge>
                    ) : r.published ? (
                      <Badge tone="green">
                        <Lock className="h-3 w-3" />
                        Published
                      </Badge>
                    ) : pct === 100 && r.required ? (
                      <Badge tone="sky" dot>
                        Ready to publish
                      </Badge>
                    ) : (
                      <Badge tone="amber" dot>
                        In progress
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.students} students · {r.papers} graded paper{r.papers === 1 ? "" : "s"}
                    {r.editablePapers < r.papers && ` · you enter ${r.editablePapers}`}
                  </p>
                </div>
                <div className="w-48">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{r.editablePapers < r.papers ? "Your marks" : "Marks entered"}</span>
                    <span className="tabular-nums">{r.editablePapers < r.papers ? `${r.mineFilled}/${r.mine}` : `${r.filled}/${r.required}`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${(r.editablePapers < r.papers ? minePct : pct) === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                      style={{ width: `${r.editablePapers < r.papers ? minePct : pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(r.published || r.access.canPreview) && (
                    <Link href={`${base}/results/${r.sectionId}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                      <FileBarChart className="h-4 w-4" />
                      Results
                    </Link>
                  )}
                  <Link
                    href={`${base}/marks/${r.sectionId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    {r.published ? "View marks" : "Enter marks"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
