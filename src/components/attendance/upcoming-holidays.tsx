import { PartyPopper } from "lucide-react";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { groupHolidays, parseISODate } from "@/lib/attendance-shared";

const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (iso: string) => dayMonth.format(parseISODate(iso)!);

/** The next few school holidays, from `from` onwards. */
export async function UpcomingHolidays({ schoolId, from, action }: { schoolId: string; from: string; action?: React.ReactNode }) {
  const holidays = groupHolidays(
    await db.holiday.findMany({ where: { schoolId, date: { gte: parseISODate(from)! } }, orderBy: { date: "asc" }, take: 40 }),
  ).slice(0, 5);
  return (
    <Card title="Upcoming holidays" icon={PartyPopper} padded={false} action={action}>
      {holidays.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No school holidays coming up.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {holidays.map((h) => (
            <li key={h.ids[0]} className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm">
              <span className="truncate text-slate-800">{h.name}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {h.from <= from ? "Today" : fmt(h.from)}
                {h.to !== h.from && ` – ${fmt(h.to)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
