import { AtSign, CalendarDays, Hash, School, UserRound, Users } from "lucide-react";
import { Card, InfoItem } from "@/components/ui";
import { StudentBanner } from "@/components/student-portal/ui";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireStudent } from "@/lib/student-auth";
import { StudentPasswordForm } from "./password-form";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function StudentAccountPage() {
  const { student, school, section } = await requireStudent();
  return (
    <>
      <StudentBanner icon={UserRound} tone="rose" title="My account" subtitle="Your details and password." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={fullName(student)} description={student.studentCode} className="self-start">
          <dl className="space-y-4">
            <InfoItem icon={AtSign} label="Username (sign-in)">
              <span className="font-mono">{student.username}</span>
            </InfoItem>
            <InfoItem icon={School} label="School">{school.name}</InfoItem>
            <InfoItem icon={Users} label="Class">{section ? sectionLabel(section) : "Not assigned"}</InfoItem>
            <InfoItem icon={Hash} label="Roll number">{student.rollNumber ?? "—"}</InfoItem>
            <InfoItem icon={CalendarDays} label="Admitted">{dateFmt.format(student.admissionDate)}</InfoItem>
          </dl>
          <p className="mt-4 text-xs text-muted">To correct your details, ask your class teacher or the school office.</p>
        </Card>
        <Card title="Change password" description="Other devices are signed out when you change it." className="xl:col-span-2">
          <StudentPasswordForm />
        </Card>
      </div>
    </>
  );
}
