import { SessionCalendar, pickCalendarMonth } from "@/components/calendar/session-calendar";
import { PageHeader } from "@/components/ui";
import { isoDate, todayISO } from "@/lib/attendance-shared";
import { loadCalendar } from "@/lib/calendar";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";

/** The school's published plan for the session. */
export default async function TeacherCalendarPage({ searchParams }: PageProps<"/teacher/calendar">) {
  const ctx = await requireTeacher();
  const session = await getCurrentSession(ctx.school.id);
  const { items } = await loadCalendar(ctx.school.id, session, { forTeacher: true });
  const start = isoDate(session.startDate);
  const end = isoDate(session.endDate);
  const today = todayISO();
  return (
    <>
      <PageHeader title="School calendar" subtitle={`Session ${session.name}: exams, tests, events and holidays planned by the school.`} />
      <SessionCalendar items={items} start={start} end={end} today={today} month={pickCalendarMonth((await searchParams).month, start, end, today)} basePath="/teacher/calendar" />
    </>
  );
}
