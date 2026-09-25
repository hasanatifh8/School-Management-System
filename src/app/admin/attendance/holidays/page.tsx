import { CalendarOff, PartyPopper, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { attendanceWindow } from "@/lib/attendance";
import { groupHolidays, isoDate, parseISODate, shortDate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { deleteSchoolHolidays } from "../actions";
import { HolidayForm } from "./holiday-form";

const dayMonth = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** School-wide holidays for the current session. */
export default async function HolidaysPage() {
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const start = isoDate(win.session.startDate);
  const end = isoDate(win.session.endDate);
  const holidays = await db.holiday.findMany({
    where: { schoolId: school.id, date: { gte: parseISODate(start)!, lte: parseISODate(end)! } },
    orderBy: { date: "asc" },
  });

  const groups = groupHolidays(holidays);
  const fmt = (iso: string) => dayMonth.format(parseISODate(iso)!);

  return (
    <>
      <PageHeader
        title="Holidays"
        breadcrumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Holidays" }]}
        subtitle={`School holidays for session ${win.session.name}. No class takes attendance on these days.`}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Add a holiday" icon={PartyPopper} className="self-start">
          <HolidayForm min={start} max={end} />
        </Card>
        <Card
          title="This session"
          description={`${holidays.length} day${holidays.length === 1 ? "" : "s"} off`}
          padded={false}
          className="xl:col-span-2"
        >
          {groups.length === 0 ? (
            <EmptyState icon={CalendarOff} title="No holidays yet" description="Add festivals, vacations and other days the school is closed." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.map((g) => {
                const past = g.to < win.today;
                return (
                  <li key={g.ids[0]} className={`flex flex-wrap items-center gap-3 px-6 py-3 ${past ? "opacity-60" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{g.name}</p>
                      <p className="text-xs text-slate-500">
                        {g.from === g.to ? fmt(g.from) : `${fmt(g.from)} – ${fmt(g.to)} · ${g.ids.length} days`}
                        {g.from.slice(0, 4) !== g.to.slice(0, 4) && ` ${shortDate.format(parseISODate(g.to)!).slice(-4)}`}
                      </p>
                    </div>
                    {g.from <= win.today && g.to >= win.today && <Badge tone="indigo">Today</Badge>}
                    {past && <Badge>Past</Badge>}
                    <ActionForm action={deleteSchoolHolidays.bind(null, g.ids)} compact className="flex flex-row-reverse items-center gap-2">
                      <SubmitButton variant="dangerGhost" size="sm" confirm={`Remove “${g.name}”?`} icon={<Trash2 className="h-4 w-4" />}>
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
