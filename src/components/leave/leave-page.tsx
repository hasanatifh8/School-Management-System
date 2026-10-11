import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { LeaveBulkBar } from "@/components/leave/leave-bulk";
import { LeaveDrawer } from "@/components/leave/leave-drawer";
import { LeaveList } from "@/components/leave/leave-list";
import { LeaveReview } from "@/components/leave/leave-review";
import { LeaveStatusCards } from "@/components/leave/leave-status-cards";
import { Pagination } from "@/components/pagination";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { leaveDetail, leaveFilters, listLeave, type LeaveActor, type LeaveView } from "@/lib/leave";
import { APPLICANT_LABELS, CATEGORY_LABELS } from "@/lib/leave-shared";

type Params = Record<string, string | string[] | undefined>;

/** The leave list with status tabs and applicant filters (admin and teacher portals). */
export async function LeavePageContent({
  actor,
  params,
  base,
  whoOptions,
  subtitle,
  personHref,
  decide,
  withdraw,
  bulkApprove,
  headerExtra,
  breadcrumbs,
}: {
  actor: LeaveActor;
  params: Params;
  base: string;
  whoOptions: { value: string; label: string }[];
  subtitle: string;
  personHref: (r: LeaveView) => string | null;
  decide: (id: string) => (approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;
  withdraw: (id: string) => () => Promise<ActionState>;
  /** Approve several selected requests at once (adds checkboxes). */
  bulkApprove?: (ids: string[]) => Promise<ActionState>;
  /** More header buttons, before "New leave request". */
  headerExtra?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  const filters = leaveFilters(params);
  const { rows, paging, byStatus, urgent } = await listLeave(actor, filters, params);
  const openId = typeof params.open === "string" ? params.open : null;
  const detail = openId ? await leaveDetail(actor, openId) : null;
  const statusKey = filters.status?.toLowerCase() ?? "all";
  const who = typeof params.who === "string" ? params.who : "";
  const href = (status: string, w: string) => {
    const q = new URLSearchParams();
    if (status !== "pending") q.set("status", status);
    if (w) q.set("who", w);
    return `${base}${q.size ? `?${q}` : ""}`;
  };
  // The current list URL (status, applicant, page) with or without an open request.
  const listHref = (open: string | null) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "open") q.set(k, v);
    if (open) q.set("open", open);
    return `${base}${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      {breadcrumbs}
      <PageHeader
        title="Leave"
        subtitle={subtitle}
        action={
          <>
            {headerExtra}
            <ButtonLink href={`${base}/new`} icon={Plus}>
              New leave request
            </ButtonLink>
          </>
        }
      />
      <LeaveStatusCards byStatus={byStatus} urgent={urgent} active={filters.status} href={(s) => href(s, who)} />
      <Card padded={false}>
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3 sm:px-6" role="group" aria-label="Filter by applicant">
          {[{ value: "", label: "Everyone" }, ...whoOptions].map((o) => (
            <Link
              key={o.value}
              href={href(statusKey, o.value)}
              scroll={false}
              aria-current={who === o.value ? "true" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${who === o.value ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
            >
              {o.label}
            </Link>
          ))}
        </div>
        {bulkApprove && <LeaveBulkBar id="leave-bulk" approve={bulkApprove} />}
        <LeaveList
          rows={rows}
          personHref={personHref}
          decide={decide}
          withdraw={withdraw}
          openHref={(id) => listHref(id)}
          bulkForm={bulkApprove ? "leave-bulk" : undefined}
          emptyText={filters.status === "PENDING" ? "No requests waiting for a decision" : "No leave requests here"}
        />
        <Pagination paging={paging} noun="requests" />
      </Card>
      {detail && (
        <LeaveDrawer
          key={detail.id}
          title={`${CATEGORY_LABELS[detail.category]} leave`}
          description={`${APPLICANT_LABELS[detail.applicant]} · ${detail.person.name}`}
          closeHref={listHref(null)}
        >
          <LeaveReview
            r={detail}
            personHref={personHref(detail)}
            attachmentHref={`/api/leave/${detail.id}/attachment`}
            decide={decide(detail.id)}
            withdraw={withdraw(detail.id)}
          />
        </LeaveDrawer>
      )}
    </>
  );
}
