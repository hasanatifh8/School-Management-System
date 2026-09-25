import { AtSign, BookOpen, Briefcase, Mail, Phone, School } from "lucide-react";
import { Card, InfoItem, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { TeacherPasswordForm } from "./password-form";

export default async function TeacherAccountPage() {
  const { teacher, school } = await requireTeacher();
  return (
    <>
      <PageHeader title="Account" subtitle="Your details and password." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={fullName(teacher)} description={teacher.employeeCode} className="self-start">
          <dl className="space-y-4">
            <InfoItem icon={AtSign} label="Username (sign-in)">
              <span className="font-mono">{teacher.username}</span>
            </InfoItem>
            <InfoItem icon={School} label="School">{school.name}</InfoItem>
            <InfoItem icon={BookOpen} label="Specialization">{teacher.specialization ?? "—"}</InfoItem>
            <InfoItem icon={Briefcase} label="Qualification">{teacher.qualification ?? "—"}</InfoItem>
            <InfoItem icon={Phone} label="Phone">{teacher.phone ?? "—"}</InfoItem>
            <InfoItem icon={Mail} label="Email">{teacher.email ?? "—"}</InfoItem>
          </dl>
          <p className="mt-4 text-xs text-slate-500">To correct your details or username, ask your school admin.</p>
        </Card>
        <Card title="Change password" description="Other devices are signed out when you change it." className="xl:col-span-2">
          <TeacherPasswordForm />
        </Card>
      </div>
    </>
  );
}
