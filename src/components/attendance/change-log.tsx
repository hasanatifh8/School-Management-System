import { ArrowRight, History } from "lucide-react";
import { Card, EmptyState, PagedList } from "@/components/ui";
import { formatISO, shortDate } from "@/lib/attendance-shared";

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const LABELS: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", HALF_DAY: "Half day", LEAVE: "Leave", ON_LEAVE: "On leave" };

export type Change = { id: string; date: string; personName: string; fromStatus: string | null; toStatus: string; note: string; changedBy: string; createdAt: Date };

/** Changes made from a register, newest first, with who made them and why. */
export function ChangeLog({ changes, description }: { changes: Change[]; description: string }) {
  return (
    <Card title="Change log" icon={History} description={description} padded={false}>
      {changes.length === 0 ? (
        <EmptyState compact icon={History} title="No changes yet" description="Edits made by clicking a day in the register show here with their reason." />
      ) : (
        <PagedList pageSize={8} noun="changes">
          {changes.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm sm:px-6">
              <p className="flex flex-wrap items-center gap-x-2 text-fg">
                <span className="font-medium">{c.personName}</span>
                <span className="text-muted">· {formatISO(c.date, shortDate)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-fg-2">
                  {c.fromStatus ? LABELS[c.fromStatus] ?? c.fromStatus : "Not marked"}
                  <ArrowRight className="h-3 w-3 text-subtle" aria-hidden />
                  <strong>{LABELS[c.toStatus] ?? c.toStatus}</strong>
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted">“{c.note}”</p>
              <p className="mt-0.5 text-[11px] text-subtle">
                {c.changedBy} · {stamp.format(c.createdAt)}
              </p>
            </li>
          ))}
        </PagedList>
      )}
    </Card>
  );
}
