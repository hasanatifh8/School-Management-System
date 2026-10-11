"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, CalendarRange, Hourglass, Inbox, Plane, UserRoundMinus } from "lucide-react";
import { LeaveDecision } from "@/components/leave/leave-actions";
import { Badge, Card, EmptyState, SegmentedControl, TextLink } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatISO, shortDate } from "@/lib/attendance-shared";
import type { LeaveOverview, LeaveView } from "@/lib/leave";
import { APPLICANT_LABELS, CATEGORY_LABELS } from "@/lib/leave-shared";

type Tab = "pending" | "today" | "upcoming";
type Decide = (id: string, approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;

const EMPTY: Record<Tab, { title: string; description: string }> = {
  pending: { title: "No requests waiting", description: "New leave requests from students, teachers and staff show here to approve." },
  today: { title: "Nobody is on leave today", description: "Approved leave covering today shows here." },
  upcoming: { title: "No upcoming leave", description: "Approved leave starting after today shows here." },
};

/**
 * Leave at a glance on the dashboard: requests waiting for a decision (approve
 * or reject right here), who is on leave today, and approved leave coming up.
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
  const listHref = tab === "pending" ? "/admin/leave?status=pending" : "/admin/leave?status=approved";

  return (
    <Card
      title="Leave"
      icon={Plane}
      description={`${overview.today.total} on leave today · ${overview.pending.total} waiting for a decision`}
      action={<TextLink href="/admin/leave">All leave</TextLink>}
      padded={false}
      className={className}
    >
      <div className="border-b border-line px-4 py-3 sm:px-6">
        <SegmentedControl
          label="Show leave"
          size="sm"
          value={tab}
          onChange={setTab}
          className="w-full sm:w-auto"
          options={[
            { value: "pending", label: `Waiting (${overview.pending.total})`, icon: Hourglass },
            { value: "today", label: `Today (${overview.today.total})`, icon: UserRoundMinus },
            { value: "upcoming", label: `Upcoming (${overview.upcoming.total})`, icon: CalendarClock },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState compact icon={Inbox} title={EMPTY[tab].title} description={EMPTY[tab].description} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <LeaveRow key={r.id} r={r} tab={tab} today={today} decide={decide} />
          ))}
          {more > 0 && (
            <li className="px-4 py-2.5 text-xs sm:px-6">
              <Link href={listHref} className="font-medium text-accent-text hover:underline">
                +{more} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function LeaveRow({ r, tab, today, decide }: { r: LeaveView; tab: Tab; today: string; decide: Decide }) {
  const range = r.from === r.to ? formatISO(r.from, shortDate) : `${formatISO(r.from, shortDate)} – ${formatISO(r.to, shortDate)}`;
  const when =
    tab === "today"
      ? r.to === today
        ? "Today only"
        : `Till ${formatISO(r.to, shortDate)}`
      : `${range} · ${r.days} day${r.days === 1 ? "" : "s"}`;
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
          <Badge tone={r.applicant === "STUDENT" ? "sky" : r.applicant === "TEACHER" ? "indigo" : "slate"}>{APPLICANT_LABELS[r.applicant]}</Badge>
          {tab === "pending" && r.from <= today && (
            <Badge tone="amber" dot>
              {r.from < today ? "Already started" : "Starts today"}
            </Badge>
          )}
        </div>
        {r.person.sub && <p className="truncate text-xs text-muted">{r.person.sub}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-2">
          <CalendarRange className="h-3.5 w-3.5 text-subtle" aria-hidden />
          <span className="font-medium">{when}</span>
          <span className="text-muted">· {CATEGORY_LABELS[r.category]}</span>
        </p>
        {tab === "pending" && r.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{r.description}</p>}
        {tab === "pending" && <p className="mt-1 text-[11px] text-subtle">Entered by {r.requestedBy}</p>}
      </div>
      {tab === "pending" && r.canDecide && <LeaveDecision name={r.person.name} decide={(approve, state, fd) => decide(r.id, approve, state, fd)} />}
    </li>
  );
}
