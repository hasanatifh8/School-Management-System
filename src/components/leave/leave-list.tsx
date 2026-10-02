import Link from "next/link";
import { CalendarRange, Inbox } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatISO, shortDate } from "@/lib/attendance-shared";
import type { LeaveView } from "@/lib/leave";
import { APPLICANT_LABELS, CATEGORY_LABELS, STATUS_LABELS, STATUS_TONES } from "@/lib/leave-shared";
import { LeaveDecision, LeaveWithdraw } from "./leave-actions";

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Leave requests with their decision controls. */
export function LeaveList({
  rows,
  personHref,
  decide,
  withdraw,
  emptyText,
}: {
  rows: LeaveView[];
  /** Link to the person's profile in this portal, or null for none. */
  personHref: (r: LeaveView) => string | null;
  decide: (id: string) => (approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;
  withdraw: (id: string) => () => Promise<ActionState>;
  emptyText: string;
}) {
  if (!rows.length) return <EmptyState icon={Inbox} title={emptyText} />;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const href = personHref(r);
        const range = r.from === r.to ? formatISO(r.from, shortDate) : `${formatISO(r.from, shortDate)} – ${formatISO(r.to, shortDate)}`;
        return (
          <li key={r.id} className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex flex-wrap items-center gap-2">
                {href ? (
                  <Link href={href} className="font-semibold text-fg hover:text-accent-text">
                    {r.person.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-fg">{r.person.name}</span>
                )}
                <Badge tone={r.applicant === "STUDENT" ? "sky" : r.applicant === "TEACHER" ? "indigo" : "slate"}>{APPLICANT_LABELS[r.applicant]}</Badge>
                {r.mine && <Badge>You</Badge>}
                <Badge tone={STATUS_TONES[r.status]} dot>
                  {STATUS_LABELS[r.status]}
                </Badge>
              </div>
              {r.person.sub && <p className="text-xs text-muted">{r.person.sub}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-fg-2">
                <CalendarRange className="h-4 w-4 text-subtle" />
                <span className="font-medium">{range}</span>
                <span className="text-muted">
                  · {r.days} day{r.days === 1 ? "" : "s"} · {CATEGORY_LABELS[r.category]}
                </span>
              </p>
              {r.description && <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.description}</p>}
              <p className="mt-2 text-xs text-subtle">
                Entered by {r.requestedBy} on {stamp.format(new Date(r.createdAt))}
                {r.decidedBy && r.decidedAt && ` · ${r.status === "APPROVED" ? "Approved" : "Rejected"} by ${r.decidedBy} on ${stamp.format(new Date(r.decidedAt))}`}
              </p>
              {r.decisionNote && (
                <p className={`mt-1 text-xs ${r.status === "REJECTED" ? "text-danger" : "text-muted"}`}>
                  Note: {r.decisionNote}
                </p>
              )}
            </div>
            <div className="flex items-start gap-1">
              {r.canDecide && <LeaveDecision name={r.person.name} decide={decide(r.id)} />}
              {r.canWithdraw && <LeaveWithdraw label={r.status === "PENDING" && r.mine ? "Withdraw request" : "Delete request"} withdraw={withdraw(r.id)} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
