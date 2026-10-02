import { Save } from "lucide-react";
import { IdCardBack } from "@/components/id-card/student-id-card";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { DEFAULT_GUIDELINES, loadStaffIdCards } from "@/lib/id-cards";
import { getCurrentSchool } from "@/lib/school";
import { saveCardBack } from "./actions";

/** The common back of student and staff ID cards: emergency contacts and guidelines. */
export default async function CardBackSettingsPage() {
  const school = await getCurrentSchool();
  const [row, preview] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: school.id }, select: { idCardEmergency: true, idCardGuidelines: true, phone: true } }),
    loadStaffIdCards(school.id, []), // just the school's card details
  ]);
  return (
    <>
      <PageHeader
        title="ID card back"
        subtitle="Printed on the back of every student and staff ID card, together with the school's address and contacts."
        breadcrumbs={[{ label: "ID cards", href: "/admin/id-cards" }, { label: "Card back" }]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <Card>
          <ActionForm action={saveCardBack} className="space-y-5">
            <Field
              label="Emergency contacts"
              name="emergency"
              hint={`One per line, up to 4, e.g. "Ambulance: 108". Left blank, the card shows the school office${row.phone ? ` (${row.phone})` : ""}.`}
            >
              <textarea name="emergency" rows={4} defaultValue={row.idCardEmergency ?? ""} placeholder={"School office: 98765 43210\nAmbulance: 108"} className={inputClass} />
            </Field>
            <Field label="Guidelines" name="guidelines" hint="One per line, up to 5. Left blank, the card shows the standard guidelines below.">
              <textarea name="guidelines" rows={5} defaultValue={row.idCardGuidelines ?? ""} placeholder={DEFAULT_GUIDELINES.join("\n")} className={inputClass} />
            </Field>
            <p className="text-xs text-muted">
              The school&apos;s name, logo, address, phone, email and website come from the school&apos;s details, which Power Admin manages.
            </p>
            <SubmitButton icon={<Save className="h-4 w-4" />}>Save card back</SubmitButton>
          </ActionForm>
        </Card>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Saved back</p>
          <div style={{ width: "calc(54mm * 1.4)", height: "calc(85.6mm * 1.4)" }}>
            <div className="origin-top-left" style={{ transform: "scale(1.4)" }}>
              <IdCardBack school={preview.school} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
