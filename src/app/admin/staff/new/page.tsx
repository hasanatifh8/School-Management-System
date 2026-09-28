import { Card, PageHeader } from "@/components/ui";
import { getCurrentSchool } from "@/lib/school";
import { createStaffMember } from "../actions";
import { StaffForm } from "../staff-form";

export default async function NewStaffPage() {
  await getCurrentSchool(); // admins only
  return (
    <>
      <PageHeader
        title="Add staff member"
        subtitle="A unique staff ID is generated automatically when you save. Upload their resume and certificates from the profile afterwards."
        breadcrumbs={[{ label: "Staff", href: "/admin/staff" }, { label: "Add staff member" }]}
      />
      <Card>
        <StaffForm action={createStaffMember} submitLabel="Add staff member" cancelHref="/admin/staff" offerCashier />
      </Card>
    </>
  );
}
