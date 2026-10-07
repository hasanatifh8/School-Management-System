import { Info, Plus, Send } from "lucide-react";
import { SessionCalendar, pickCalendarMonth } from "@/components/calendar/session-calendar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Callout, PageHeader } from "@/components/ui";
import { isoDate, todayISO } from "@/lib/attendance-shared";
import { loadCalendar } from "@/lib/calendar";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { publishCalendar } from "./actions";

/** The session plan: exams, tests, sports day, holidays… Teachers see what is published. */
export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const school = await getCurrentSchool();
  const session = await getCurrentSession(school.id);
  const { items, drafts } = await loadCalendar(school.id, session, { links: "admin" });
  const start = isoDate(session.startDate);
  const end = isoDate(session.endDate);
  const today = todayISO();
  const month = pickCalendarMonth((await searchParams).month, start, end, today);

  return (
    <>
      <PageHeader
        title="School calendar"
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "School calendar" }]}
        subtitle={`Plan session ${session.name}: exams, tests, sports day, meetings and holidays. Teachers see it once published.`}
        action={
          <>
            {drafts > 0 && (
              <ActionForm action={publishCalendar} compact className="flex flex-row-reverse items-center gap-2">
                <SubmitButton
                  variant="secondary"
                  icon={<Send className="h-4 w-4" />}
                  confirm={`Publish ${drafts} draft entr${drafts === 1 ? "y" : "ies"}?`}
                  confirmMessage="Teachers will see them, and any holidays become attendance holidays."
                >
                  Publish {drafts} draft{drafts === 1 ? "" : "s"}
                </SubmitButton>
              </ActionForm>
            )}
            <ButtonLink href="/admin/calendar/new" icon={Plus}>
              Add entry
            </ButtonLink>
          </>
        }
      />
      {drafts > 0 && (
        <Callout icon={Info} tone="warning" className="mb-6">
          <strong className="font-semibold">{drafts} draft entr{drafts === 1 ? "y is" : "ies are"} not visible to teachers yet.</strong> Publish when the plan is ready.
        </Callout>
      )}
      <SessionCalendar items={items} start={start} end={end} today={today} month={month} basePath="/admin/calendar" />
    </>
  );
}
