"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarClock, CalendarRange, Hourglass, Inbox, Plane, UserRoundMinus } from "lucide-react";
import { LeaveDecision } from "@/components/leave/leave-actions";
import { Avatar, Badge, Card, EmptyState, SegmentedControl, TextLink } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatISO, shortDate } from "@/lib/attendance-shared";
import type { LeaveOverview, LeaveView } from "@/lib/leave";
import { APPLICANT_LABELS, CATEGORY_LABELS, LEAVE_APPLICANTS, type LeaveApplicantKey } from "@/lib/leave-shared";

type Tab = "pending" | "today" | "upcoming";
type Decide = (id: string, approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;

const EMPTY: Record<Tab, { title: string; description: string }> = {
  pending: { title: "No requests waiting", description: "New leave requests from students, teachers and staff show here to approve." },
  today: { title: "Nobody is on leave today", description: "Approved leave covering today shows here." },
  upcoming: { title: "No upcoming leave", description: "Approved leave starting after today shows here." },
};

const APPLICANT_TONE = { STUDENT: "sky", TEACHER: "indigo", STAFF: "slate" } as const;
const PLURAL: Record<LeaveApplicantKey, [string, string]> = { STUDENT: ["student", "students"], TEACHER: ["teacher", "teachers"], STAFF: ["staff", "staff"] };

/**
 * Leave at a glance on the dashboard: requests waiting for a decision (approve
 * or reject right here), who is on leave today, and approved leave coming up.
 * It stays a fixed, small size however many are on leave: people show as a
 * compact grid of the first few, with a count by type and a link to the rest.
 */
export function LeaveWidget({
  overview,
  today,
  decide,
  className,
}: {
  overview: LeaveOverview;
  /** ISO date the overview is for. */
  today: string;
  decide: Decide;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>(overview.pending.total ? "pending" : "today");
  const { rows, total } = overview[tab];
  const more = total - rows.length;
  const byApplicant = tab === "pending" ? null : overview[tab].byApplicant;
  const listHref = tab === "pending" ? "/admin/leave?status=pending" : tab === "today" ? `/admin/leave?on=${today}` : "/admin/leave?status=approved";
  const allLabel = tab === "pending" ? `Review all ${total} waiting` : tab === "today" ? `View all ${total} on leave today` : `View all ${total} upcoming`;

  return (
    <Card
      title="Leave"
      icon={Plane}
      description={`${overview.today.total} on leave today · ${overview.pending.total} waiting for a decision`}
      action={
        // With more than the cards show, a notification-style count of them all on the link to the full list.
        more > 0 ? (
          <Link
            href={listHref}
            aria-label={`${allLabel} (${total})`}
            className="inline-flex items-center gap-2 rounded-full text-sm font-medium text-accent-text hover:underline"
          >
            All leave
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold tabular-nums leading-none text-white shadow-sm">
              {total > 99 ? "99+" : total}
            </span>
          </Link>
        ) : (
          <TextLink href="/admin/leave">All leave</TextLink>
        )
      }
      padded={false}
      className={className}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
        <SegmentedControl
          label="Show leave"
          size="sm"
          value={tab}
          onChange={setTab}
          className="w-full max-w-full overflow-x-auto sm:w-auto"
          options={[
            { value: "pending", label: `Waiting (${overview.pending.total})`, icon: Hourglass },
            { value: "today", label: `Today (${overview.today.total})`, icon: UserRoundMinus },
            { value: "upcoming", label: `Upcoming (${overview.upcoming.total})`, icon: CalendarClock },
          ]}
        />
        {byApplicant && total > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {LEAVE_APPLICANTS.filter((a) => byApplicant[a] > 0).map((a) => (
              <Badge key={a} tone={APPLICANT_TONE[a]}>
                {byApplicant[a]} {PLURAL[a][byApplicant[a] === 1 ? 0 : 1]}
              </Badge>
            ))}
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState compact icon={Inbox} title={EMPTY[tab].title} description={EMPTY[tab].description} />
      ) : tab === "pending" ? (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <LeaveRow key={r.id} r={r} today={today} decide={decide} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map((r) => (
            <LeaveTile key={r.id} r={r} tab={tab} today={today} />
          ))}
        </ul>
      )}
      {more > 0 && (
        <Link
          href={listHref}
          className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm font-medium text-accent-text transition hover:bg-surface-2 sm:px-6"
        >
          <span>
            {allLabel}
            <span className="ml-1.5 font-normal text-muted">· {more} more not shown</span>
          </span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </Card>
  );
}

/** A request waiting for a decision, with approve / reject. */
function LeaveRow({ r, today, decide }: { r: LeaveView; today: string; decide: Decide }) {
  const range = r.from === r.to ? formatISO(r.from, shortDate) : `${formatISO(r.from, shortDate)} – ${formatISO(r.to, shortDate)}`;
  const href = r.person.href ? `/admin${r.person.href}` : null;

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="truncate text-sm font-medium text-fg hover:text-accent-text">
              {r.person.name}
            </Link>
          ) : (
            <span className="truncate text-sm font-medium text-fg">{r.person.name}</span>
          )}
          <Badge tone={APPLICANT_TONE[r.applicant]}>{APPLICANT_LABELS[r.applicant]}</Badge>
          {r.from <= today && (
            <Badge tone="amber" dot>
              {r.from < today ? "Already started" : "Starts today"}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-2">
          {r.person.sub && <span className="text-muted">{r.person.sub} ·</span>}
          <CalendarRange className="h-3.5 w-3.5 text-subtle" aria-hidden />
          <span className="font-medium">
            {range} · {r.days} day{r.days === 1 ? "" : "s"}
          </span>
          <span className="text-muted">· {CATEGORY_LABELS[r.category]}</span>
        </p>
        {r.description && <p className="mt-1 line-clamp-1 text-xs text-muted">{r.description}</p>}
      </div>
      {r.canDecide && <LeaveDecision name={r.person.name} decide={(approve, state, fd) => decide(r.id, approve, state, fd)} />}
    </li>
  );
}

/** Someone on leave (today or coming up), as a small tile in the grid. */
function LeaveTile({ r, tab, today }: { r: LeaveView; tab: Tab; today: string }) {
  const href = r.person.href ? `/admin${r.person.href}` : null;
  const when =
    tab === "today"
      ? r.to === today
        ? "Today only"
        : `Till ${formatISO(r.to, shortDate)}`
      : r.from === r.to
        ? formatISO(r.from, shortDate)
        : `${formatISO(r.from, shortDate)} – ${formatISO(r.to, shortDate)}`;
  const body = (
    <>
      <Avatar name={r.person.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-fg">{r.person.name}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[r.applicant]}`} title={APPLICANT_LABELS[r.applicant]} aria-label={APPLICANT_LABELS[r.applicant]} />
        </span>
        <span className="block truncate text-xs text-muted">{r.person.sub}</span>
        <span className="mt-0.5 block truncate text-xs text-fg-2">
          <span className="font-medium">{when}</span>
          <span className="text-muted"> · {CATEGORY_LABELS[r.category]}</span>
        </span>
      </span>
    </>
  );
  const box = "flex h-full items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${box} transition hover:border-line-strong hover:bg-surface-2`}>
          {body}
        </Link>
      ) : (
        <div className={box}>{body}</div>
      )}
    </li>
  );
}

const DOT: Record<LeaveApplicantKey, string> = { STUDENT: "bg-sky-500", TEACHER: "bg-indigo-500", STAFF: "bg-slate-400" };
