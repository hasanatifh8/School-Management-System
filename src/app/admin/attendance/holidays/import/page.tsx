import { ImportPanel } from "@/components/import-panel";
import { PageHeader } from "@/components/ui";
import { attendanceWindow } from "@/lib/attendance";
import { IMPORT_COLUMNS } from "@/lib/import/columns";
import { getCurrentSchool } from "@/lib/school";
import { importHolidays } from "./actions";

export default async function ImportHolidaysPage() {
  const school = await getCurrentSchool(); // admins only
  const { session } = await attendanceWindow(school.id);
  return (
    <>
      <PageHeader
        title="Upload holidays"
        subtitle={`Add the school's holidays for session ${session.name} from an Excel sheet.`}
        breadcrumbs={[
          { label: "Attendance", href: "/admin/attendance" },
          { label: "Holidays", href: "/admin/attendance/holidays" },
          { label: "Upload" },
        ]}
      />
      <ImportPanel
        noun={{ one: "holiday", many: "holidays" }}
        columns={IMPORT_COLUMNS.holidays}
        templateHref="/api/templates/holidays"
        listHref="/admin/attendance/holidays"
        intro="Fill one holiday per row: a single date, or From and To dates for a break. Sundays (and Saturdays, if they are off) are already off, so don't list them; they are skipped inside a break."
        action={importHolidays}
      />
    </>
  );
}
