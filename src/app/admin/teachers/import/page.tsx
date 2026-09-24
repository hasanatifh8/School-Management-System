import { ImportPanel } from "@/components/import-panel";
import { PageHeader } from "@/components/ui";
import { IMPORT_COLUMNS } from "@/lib/import/columns";
import { importTeachers } from "./actions";

export default function ImportTeachersPage() {
  return (
    <>
      <PageHeader
        title="Bulk upload teachers"
        subtitle="Add many teachers at once from an Excel sheet. Teacher IDs are generated automatically."
        breadcrumbs={[{ label: "Teachers", href: "/admin/teachers" }, { label: "Bulk upload" }]}
      />
      <ImportPanel
        noun={{ one: "teacher", many: "teachers" }}
        columns={IMPORT_COLUMNS.teachers}
        templateHref="/api/templates/teachers"
        listHref="/admin/teachers"
        action={importTeachers}
      />
    </>
  );
}
