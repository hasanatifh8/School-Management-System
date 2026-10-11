import Link from "next/link";
import { CalendarRange, ChevronRight, Inbox, Paperclip, TriangleAlert } from "lucide-react";
import { Badge, EmptyState, checkboxClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatISO, shortDate } from "@/lib/attendance-shared";
import type { LeaveView } from "@/lib/leave";
import { APPLICANT_LABELS, CATEGORY_LABELS, LEAVE_URGENT_HOURS, STATUS_LABELS, STATUS_TONES } from "@/lib/leave-shared";
import { LeaveDecision, LeaveWithdraw } from "./leave-actions";

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** "3 days" / "5 hours" for how long a request has been waiting. */
const waited = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} days` : `${h} hours`);

/** Leave requests with their decision controls. */
export function LeaveList({
  rows,
  personHref,
  decide,
  withdraw,
  emptyText,
  openHref,
  bulkForm,
}: {
  rows: (LeaveView & { clash?: string | null })[];
  /** Opens the review drawer for a request. */
  openHref?: (id: string) => string;
  /** Id of the bulk-approve form: pending rows the viewer can decide get a checkbox. */
  bulkForm?: string;
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
          <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
            {bulkForm && (
              <span className="w-5 pt-0.5">
                {r.canDecide && (
                  <input type="checkbox" name="ids" value={r.id} form={bulkForm} aria-label={`Select ${r.person.name}'s request`} className={checkboxClass} />
                )}
              </span>
            )}
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
                {r.waitingHours != null && r.waitingHours >= LEAVE_URGENT_HOURS && (
                  <Badge tone="red" dot>
                    Waiting {waited(r.waitingHours)}
                  </Badge>
                )}
                {r.attachment && (
                  <span title={r.attachment.fileName} className="inline-flex items-center gap-1 text-xs text-muted">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden /> Document
                  </span>
                )}
              </div>
              {r.person.sub && <p className="text-xs text-muted">{r.person.sub}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-fg-2">
                <CalendarRange className="h-4 w-4 text-subtle" />
                <span className="font-medium">{range}</span>
                <span className="text-muted">
                  · {r.days} day{r.days === 1 ? "" : "s"} · {CATEGORY_LABELS[r.category]}
                </span>
              </p>
              {r.description && <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted">{r.description}</p>}
              {r.clash && (
                <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning-line">
                  <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  Warning: {r.clash}
                </p>
              )}
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
              {openHref && (
                <Link href={openHref(r.id)} scroll={false} className="inline-flex h-8 items-center gap-0.5 rounded-lg px-2.5 text-xs font-medium text-accent-text transition hover:bg-accent-soft">
                  Review
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
              {r.canDecide && <LeaveDecision name={r.person.name} decide={decide(r.id)} />}
              {r.canWithdraw && <LeaveWithdraw label={r.status === "PENDING" && r.mine ? "Withdraw request" : "Delete request"} withdraw={withdraw(r.id)} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
