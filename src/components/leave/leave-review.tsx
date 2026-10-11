import Link from "next/link";
import { CalendarRange, ExternalLink, FileText, History, Paperclip, TriangleAlert, Wallet } from "lucide-react";
import { Badge } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatISO, shortDate } from "@/lib/attendance-shared";
import type { LeaveDetail } from "@/lib/leave";
import { APPLICANT_LABELS, CATEGORY_LABELS, LEAVE_URGENT_HOURS, STATUS_LABELS, STATUS_TONES } from "@/lib/leave-shared";
import { LeaveDecision, LeaveWithdraw } from "./leave-actions";

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const range = (from: string, to: string) => (from === to ? formatISO(from, shortDate) : `${formatISO(from, shortDate)} – ${formatISO(to, shortDate)}`);

function Section({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-6 py-4 last:border-0">
      <h3 className="mb-2 flex items-center gap-1.5 text-eyebrow uppercase text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The body of the review drawer: who, when (calendar and working days), the
 * document, the leave balance, clash warnings, history and the decision.
 */
export function LeaveReview({
  r,
  personHref,
  attachmentHref,
  decide,
  withdraw,
}: {
  r: LeaveDetail;
  personHref: string | null;
  attachmentHref: string;
  decide: (approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;
  withdraw: () => Promise<ActionState>;
}) {
  const isImage = r.attachment?.mimeType.startsWith("image/");
  const thisCategory = r.balance?.rows.find((b) => b.category === r.category);
  const left = thisCategory?.allowed != null ? thisCategory.allowed - thisCategory.used : null;
  const after = left != null && r.status === "PENDING" ? left - r.workingDays : null;

  return (
    <div className="text-sm">
      {/* Applicant */}
      <section className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-4">
        <div className="min-w-0 flex-1">
          {personHref ? (
            <Link href={personHref} className="text-base font-semibold text-fg hover:text-accent-text">
              {r.person.name}
            </Link>
          ) : (
            <p className="text-base font-semibold text-fg">{r.person.name}</p>
          )}
          {r.person.sub && <p className="text-xs text-muted">{r.person.sub}</p>}
        </div>
        <Badge tone={r.applicant === "STUDENT" ? "sky" : r.applicant === "TEACHER" ? "indigo" : "slate"}>{APPLICANT_LABELS[r.applicant]}</Badge>
        <Badge tone={STATUS_TONES[r.status]} dot>
          {STATUS_LABELS[r.status]}
        </Badge>
        {r.waitingHours != null && r.waitingHours >= LEAVE_URGENT_HOURS && (
          <Badge tone="red" dot>
            Waiting {Math.floor(r.waitingHours / 24)} days
          </Badge>
        )}
      </section>

      {r.clash && (
        <p className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning ring-1 ring-inset ring-warning-line">
          <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
          Warning: {r.clash}
        </p>
      )}

      <Section icon={CalendarRange} title="Leave">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <dt className="text-xs text-muted">Type</dt>
            <dd className="font-medium text-fg">{CATEGORY_LABELS[r.category]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Dates</dt>
            <dd className="font-medium text-fg">{range(r.from, r.to)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Working days</dt>
            <dd className="font-semibold text-fg">
              {r.workingDays} <span className="text-xs font-normal text-muted">of {r.days} calendar day{r.days === 1 ? "" : "s"}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Entered</dt>
            <dd className="text-fg-2">
              {r.requestedBy}
              <span className="block text-xs text-muted">{stamp.format(new Date(r.createdAt))}</span>
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-subtle">Working days leave out Sundays and school holidays.</p>
        {r.description && <p className="mt-3 whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-fg-2">{r.description}</p>}
        {r.decidedBy && r.decidedAt && (
          <p className={`mt-3 text-xs ${r.status === "REJECTED" ? "text-danger" : "text-muted"}`}>
            {r.status === "APPROVED" ? "Approved" : "Rejected"} by {r.decidedBy} on {stamp.format(new Date(r.decidedAt))}
            {r.decisionNote && <span className="block">Note: {r.decisionNote}</span>}
          </p>
        )}
      </Section>

      {r.attachment && (
        <Section icon={Paperclip} title="Document">
          <a href={attachmentHref} target="_blank" rel="noopener" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline">
            {r.attachment.fileName} <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachmentHref} alt={`Document: ${r.attachment.fileName}`} className="max-h-96 w-full rounded-lg border border-line object-contain" />
          ) : (
            <iframe src={attachmentHref} title={r.attachment.fileName} className="h-96 w-full rounded-lg border border-line bg-white" />
          )}
        </Section>
      )}

      {r.balance && (
        <Section icon={Wallet} title={`Leave balance · Session ${r.balance.session}`}>
          <ul className="space-y-2.5">
            {r.balance.rows
              .filter((b) => b.allowed != null || b.used || b.pending)
              .map((b) => {
                const remaining = b.allowed != null ? b.allowed - b.used : null;
                const pct = b.allowed ? Math.min(100, (b.used / b.allowed) * 100) : 0;
                return (
                  <li key={b.category} className={b.category === r.category ? "rounded-lg bg-accent-soft/50 px-2 py-1.5" : "px-2"}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-fg">{CATEGORY_LABELS[b.category]}</span>
                      <span className="text-xs tabular-nums text-fg-2">
                        {remaining != null ? (
                          <>
                            <strong className={remaining <= 0 ? "text-danger" : "text-fg"}>{remaining}</strong> / {b.allowed} remaining
                          </>
                        ) : (
                          `${b.used} taken · no limit set`
                        )}
                      </span>
                    </div>
                    {b.allowed != null && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div className={`h-full rounded-full ${remaining! <= 0 ? "bg-danger-solid" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {b.pending > 0 && <p className="mt-0.5 text-[11px] text-muted">{b.pending} day(s) waiting for approval, this one included</p>}
                  </li>
                );
              })}
          </ul>
          {after != null && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${after < 0 ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg-2"}`}>
              {after < 0
                ? `Approving uses ${r.workingDays} day(s): ${-after} more than the ${CATEGORY_LABELS[r.category].toLowerCase()} allowance left (would be loss of pay).`
                : `After approving: ${after} ${CATEGORY_LABELS[r.category].toLowerCase()} day(s) left.`}
            </p>
          )}
          {r.balance.rows.every((b) => b.allowed == null) && <p className="mt-2 text-xs text-muted">No allowances set. Set them under Leave → Leave allowances.</p>}
        </Section>
      )}

      {r.history.length > 0 && (
        <Section icon={History} title="Earlier requests">
          <ul className="space-y-1.5">
            {r.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-fg-2">
                  {range(h.from, h.to)} · {CATEGORY_LABELS[h.category]}
                </span>
                <Badge tone={STATUS_TONES[h.status]}>{STATUS_LABELS[h.status]}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(r.canDecide || r.canWithdraw) && (
        <div className="sticky bottom-0 flex flex-wrap items-start justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">
          {r.canWithdraw && <LeaveWithdraw label={r.status === "PENDING" && r.mine ? "Withdraw request" : "Delete request"} withdraw={withdraw} />}
          {r.canDecide && <LeaveDecision name={r.person.name} decide={decide} />}
        </div>
      )}
    </div>
  );
}
