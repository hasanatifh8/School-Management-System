import { Clock3, Plane, UserRoundCheck, UserRoundX } from "lucide-react";
import { StatCard, StatGrid } from "@/components/ui";
import { share, type DayRoster, type RosterFilter, type RosterGroup } from "@/lib/attendance-day";

/** Roster link for one KPI bucket on a date. */
export const rosterHref = (group: RosterGroup, status: RosterFilter | null, date: string) =>
  `/admin/attendance/list?group=${group}${status ? `&status=${status}` : ""}&date=${date}`;

/**
 * Present / Absent / On leave / Late for one group on one day. Every card opens
 * the roster filtered to that bucket; `active` highlights the current one.
 */
export function DayKpis({ group, date, roster, active, today }: { group: RosterGroup; date: string; roster: DayRoster; active?: RosterFilter | null; today: boolean }) {
  const { counts, marked, total } = roster;
  const day = today ? "today" : "this day";
  const of = marked ? `of ${marked} marked` : "Nothing marked yet";
  return (
    <StatGrid>
      <StatCard
        href={rosterHref(group, "present", date)}
        active={active === "present"}
        icon={UserRoundCheck}
        tone="emerald"
        label={`Present ${day}`}
        value={counts.present}
        detail={marked ? `${share(counts.present, marked)}% ${of}` : of}
      />
      <StatCard
        href={rosterHref(group, "absent", date)}
        active={active === "absent"}
        icon={UserRoundX}
        tone="rose"
        label={`Absent ${day}`}
        value={counts.absent}
        detail={marked ? `${share(counts.absent, marked)}% ${of}` : of}
      />
      <StatCard
        href={rosterHref(group, "leave", date)}
        active={active === "leave"}
        icon={Plane}
        tone="violet"
        label={`On leave ${day}`}
        value={counts.leave}
        detail={`Approved leave · ${share(counts.leave, total) ?? 0}% of ${total}`}
      />
      <StatCard
        href={rosterHref(group, "late", date)}
        active={active === "late"}
        icon={Clock3}
        tone="amber"
        label="Late arrivals"
        value={counts.late}
        detail={counts.unmarked ? `${counts.unmarked} not marked yet` : "Everyone marked"}
      />
    </StatGrid>
  );
}
