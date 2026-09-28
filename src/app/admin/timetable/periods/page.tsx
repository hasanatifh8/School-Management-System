import { Bell } from "lucide-react";
import { PeriodsEditor } from "@/components/timetable/periods-editor";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { getPeriods } from "@/lib/timetable";
import { savePeriods } from "../actions";

/** The school's bell schedule, shared by every class timetable. */
export default async function BellSchedulePage() {
  const school = await getCurrentSchool();
  const [periods, { timetableDays }] = await Promise.all([
    getPeriods(school.id),
    db.school.findUniqueOrThrow({ where: { id: school.id }, select: { timetableDays: true } }),
  ]);
  const periodRows = periods.map((p) => ({ id: p.id, name: p.name, startTime: p.startTime, endTime: p.endTime, isBreak: p.isBreak }));
  return (
    <Card title="Bell schedule" icon={Bell} description="The periods of a school day and the days the school runs. Every class timetable uses this.">
      <PeriodsEditor
        key={JSON.stringify([periodRows, timetableDays])}
        periods={periodRows}
        days={timetableDays}
        action={savePeriods}
      />
    </Card>
  );
}
