import { AtSign, BookOpen, Briefcase, Crown, Mail, Phone, School } from "lucide-react";
import { Badge, Card, InfoItem, PageHeader } from "@/components/ui";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { TeacherPasswordForm } from "./password-form";

export default async function TeacherAccountPage() {
  const { teacher, school, classSection, subjectSections } = await requireTeacher();
  // Subject → sections, e.g. "Mathematics: Class 5 – A, Class 6 – B".
  const bySubject = new Map<string, string[]>();
  for (const s of subjectSections) for (const name of s.subjects) bySubject.set(name, [...(bySubject.get(name) ?? []), sectionLabel(s.section)]);
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
        <Card title="My classes & subjects" icon={BookOpen} description="Assigned by your school admin." className="self-start xl:col-span-2 xl:order-last">
          <dl className="space-y-4">
            <InfoItem icon={Crown} label="Class teacher of">
              {classSection ? sectionLabel(classSection) : "Not a class teacher"}
            </InfoItem>
            <InfoItem icon={BookOpen} label="Subject teacher of">
              {bySubject.size ? (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {[...bySubject].map(([subject, sections]) => (
                    <Badge key={subject} tone="sky">
                      {subject} · {sections.join(", ")}
                    </Badge>
                  ))}
                </span>
              ) : (
                "No subjects assigned"
              )}
            </InfoItem>
          </dl>
        </Card>
        <Card title="Change password" description="Other devices are signed out when you change it." className="xl:col-span-2">
          <TeacherPasswordForm />
        </Card>
      </div>
    </>
  );
}
