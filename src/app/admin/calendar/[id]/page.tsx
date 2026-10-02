import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { isoDate } from "@/lib/attendance-shared";
import { EVENT_META } from "@/lib/calendar-shared";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { deleteCalendarEvent, saveCalendarEvent } from "../actions";
import { EventForm } from "../event-form";

export default async function EditCalendarEventPage({ params }: PageProps<"/admin/calendar/[id]">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const event = await db.calendarEvent.findFirst({
    where: { id, schoolId: school.id },
    include: { session: true, attachment: { select: { fileName: true } } },
  });
  if (!event) notFound();
  const classes = await db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });

  return (
    <>
      <PageHeader
        title={event.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {EVENT_META[event.type].label}
            {event.published ? <Badge tone="green">Published, teachers can see it</Badge> : <Badge tone="amber">Draft</Badge>}
          </span>
        }
        breadcrumbs={[{ label: "School calendar", href: `/admin/calendar?month=${isoDate(event.startDate).slice(0, 7)}` }, { label: event.title }]}
      />
      <div className="space-y-6">
        <Card>
          <EventForm
            key={event.updatedAt.toISOString()}
            action={saveCalendarEvent.bind(null, event.id)}
            classes={classes}
            values={{
              type: event.type,
              title: event.title,
              startDate: isoDate(event.startDate),
              endDate: isoDate(event.endDate),
              description: event.description ?? "",
              classIds: event.classIds,
              attachment: event.attachment ? { name: event.attachment.fileName, href: `/api/calendar/${event.id}/attachment` } : null,
            }}
            minDate={isoDate(event.session.startDate)}
            maxDate={isoDate(event.session.endDate)}
            submitLabel="Save changes"
          />
        </Card>
        <Card title="Delete entry" description={event.type === "HOLIDAY" && event.published ? "Its holiday days are removed from attendance too." : undefined}>
          <ActionForm action={deleteCalendarEvent.bind(null, event.id)} compact className="flex flex-row-reverse items-center justify-end gap-3">
            <SubmitButton variant="danger" confirm={`Delete “${event.title}”?`} icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
