import { Card, PageHeader } from "@/components/ui";
import { isoDate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { saveCalendarEvent } from "../actions";
import { EventForm } from "../event-form";

export default async function NewCalendarEventPage() {
  const school = await getCurrentSchool();
  const [session, classes] = await Promise.all([
    getCurrentSession(school.id),
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader
        title="Add to calendar"
        subtitle="Saved as a draft. Publish from the calendar when the plan is ready."
        breadcrumbs={[{ label: "School calendar", href: "/admin/calendar" }, { label: "Add entry" }]}
      />
      <Card>
        <EventForm
          action={saveCalendarEvent.bind(null, null)}
          classes={classes}
          minDate={isoDate(session.startDate)}
          maxDate={isoDate(session.endDate)}
          submitLabel="Save draft"
        />
      </Card>
    </>
  );
}
