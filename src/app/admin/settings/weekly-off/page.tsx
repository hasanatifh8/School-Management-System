import { CalendarOff, Info } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Callout, Card, PageHeader, checkboxClass } from "@/components/ui";
import { getSaturdayOff } from "@/lib/attendance";
import { getCurrentSchool } from "@/lib/school";
import { saveWeeklyOff } from "./actions";

/**
 * Weekly offs: Sunday always, and optionally Saturday. On a weekly off no
 * attendance can be marked for students, teachers or staff, and the day is
 * not counted as a working day anywhere (attendance %, registers, leave days).
 */
export default async function WeeklyOffPage() {
  const school = await getCurrentSchool();
  const saturdayOff = await getSaturdayOff(school.id);
  return (
    <>
      <PageHeader
        title="Weekly off"
        subtitle="Days the school is closed every week. No attendance is marked on them, and they are not counted as working days."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Weekly off" }]}
      />
      <Card title="Weekly offs" icon={CalendarOff} className="max-w-2xl">
        <ActionForm action={saveWeeklyOff} className="space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 opacity-80">
            <input type="checkbox" checked disabled className={`${checkboxClass} mt-0.5`} aria-describedby="sunday-note" />
            <span>
              <span className="block text-sm font-medium text-fg">Sunday</span>
              <span id="sunday-note" className="block text-xs text-muted">
                Always a weekly off.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 transition hover:bg-surface-2">
            <input type="checkbox" name="saturdayOff" defaultChecked={saturdayOff} className={`${checkboxClass} mt-0.5`} />
            <span>
              <span className="block text-sm font-medium text-fg">Saturday</span>
              <span className="block text-xs text-muted">Tick if the school is closed every Saturday (a five-day week).</span>
            </span>
          </label>
          <Callout icon={Info}>
            On a weekly off, attendance can&apos;t be marked for students, teachers or staff (including teachers&apos; self check-in), and the day isn&apos;t counted in attendance percentages,
            registers or leave days. For a one-off closure, add a school holiday instead.
          </Callout>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
