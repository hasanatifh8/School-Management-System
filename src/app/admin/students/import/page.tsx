import { getCurrentSchool } from "@/lib/school";
import { ImportPanel } from "@/components/import-panel";
import { PageHeader } from "@/components/ui";
import { IMPORT_COLUMNS } from "@/lib/import/columns";
import { importStudents } from "./actions";

export default async function ImportStudentsPage() {
  await getCurrentSchool(); // admins only
  return (
    <>
      <PageHeader
        title="Bulk upload students"
        subtitle="Add many students at once from an Excel sheet. Student IDs are generated automatically."
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: "Bulk upload" }]}
      />
      <ImportPanel
        noun={{ one: "student", many: "students" }}
        columns={IMPORT_COLUMNS.students}
        templateHref="/api/templates/students"
        listHref="/admin/students"
        action={importStudents}
      />
    </>
  );
}
