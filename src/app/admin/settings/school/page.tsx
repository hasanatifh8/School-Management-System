import { Card, PageHeader } from "@/components/ui";
import { SchoolForm } from "@/components/school-form";
import { db } from "@/lib/db";
import { getCurrentSchool, schoolLogoUrl } from "@/lib/school";
import { saveSchoolDetails } from "./actions";

/** The school's profile as Power Admin set it up, editable by the school's admins. */
export default async function SchoolDetailsPage() {
  const { id } = await getCurrentSchool();
  const school = await db.school.findUniqueOrThrow({ where: { id }, include: { logo: { select: { updatedAt: true } } } });
  return (
    <>
      <PageHeader
        title="School details"
        subtitle="Name, logo, affiliation and contacts. They appear on receipts, ID cards, report cards and other printed documents."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "School details" }]}
      />
      <Card>
        <SchoolForm action={saveSchoolDetails} school={school} logoUrl={schoolLogoUrl(school)} submitLabel="Save changes" lockCode />
      </Card>
    </>
  );
}
