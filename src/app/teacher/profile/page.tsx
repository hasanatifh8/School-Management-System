import { BookOpen, Briefcase, CalendarDays, Crown, Droplet, KeyRound, Lock, Mail, MapPin, MessageCircle, Pencil, Phone, Plane, UserRound } from "lucide-react";
import { Avatar, Badge, ButtonLink, Card, InfoItem, PageHeader } from "@/components/ui";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { leaveBalance } from "@/lib/leave";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { updateMyProfile } from "../actions";
import { MyProfileForm } from "./my-profile-form";

const GENDER_LABELS = { MALE: "Male", FEMALE: "Female", OTHER: "Other" } as const;
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** The teacher's own profile: everything the school holds about them, with the parts they may change. */
export default async function MyProfilePage() {
  const { teacher, school, classSections, subjectSections } = await requireTeacher();
  const balance = await leaveBalance(school.id, "TEACHER", teacher.id);
  const name = fullName(teacher);
  const photo = photoUrl(teacher.photoId);
  // Subject → sections, e.g. "Mathematics: Class 5 – A, Class 6 – B".
  const bySubject = new Map<string, string[]>();
  for (const s of subjectSections) for (const subject of s.subjects) bySubject.set(subject, [...(bySubject.get(subject) ?? []), sectionLabel(s.section)]);

  return (
    <>
      <PageHeader
        leading={
          <span className="rounded-full ring-4 ring-surface">
            <Avatar name={name} src={photo} size="xl" />
          </span>
        }
        eyebrow={<span className="font-mono normal-case tracking-normal">{teacher.employeeCode}</span>}
        title={name}
        subtitle={
          <>
            <span>{[teacher.specialization, school.name].filter(Boolean).join(" · ")}</span>
            {classSections.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-2">
                {classSections.map((s) => (
                  <Badge key={s.id} tone="indigo">
                    <Crown className="h-3 w-3" /> Class teacher · {sectionLabel(s)}
                  </Badge>
                ))}
              </span>
            )}
          </>
        }
        action={
          <ButtonLink href="/teacher/account" variant="secondary" icon={KeyRound}>
            Password
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <Card title="Personal" icon={UserRound}>
            <dl className="space-y-4">
              <InfoItem icon={UserRound} label="Full name">
                {name}
              </InfoItem>
              <InfoItem icon={UserRound} label="Gender">
                {teacher.gender ? GENDER_LABELS[teacher.gender] : "—"}
              </InfoItem>
              <InfoItem icon={CalendarDays} label="Date of birth">
                {teacher.dateOfBirth ? dateFormat.format(teacher.dateOfBirth) : "—"}
              </InfoItem>
              <InfoItem icon={Droplet} label="Blood group">
                {teacher.bloodGroup ? BLOOD_GROUP_LABELS[teacher.bloodGroup] : "—"}
              </InfoItem>
            </dl>
          </Card>
          <Card title="Contact" icon={Phone}>
            <dl className="space-y-4">
              <InfoItem icon={Phone} label="Mobile">
                {teacher.phone ?? "—"}
              </InfoItem>
              <InfoItem icon={MessageCircle} label="WhatsApp">
                {teacher.whatsappNumber ?? "—"}
              </InfoItem>
              <InfoItem icon={Mail} label="Email">
                {teacher.email ?? "—"}
              </InfoItem>
              <InfoItem icon={MapPin} label="Address">
                {teacher.address ?? "—"}
              </InfoItem>
            </dl>
          </Card>
          <Card title="Work" icon={Briefcase}>
            <dl className="space-y-4">
              <InfoItem icon={CalendarDays} label="Joined">
                {dateFormat.format(teacher.joiningDate)}
              </InfoItem>
              <InfoItem icon={BookOpen} label="Specialization">
                {teacher.specialization ?? "—"}
              </InfoItem>
              <InfoItem icon={Briefcase} label="Qualification">
                {teacher.qualification ?? "—"}
              </InfoItem>
              <InfoItem icon={Briefcase} label="Experience before joining">
                {teacher.experienceYears != null ? `${teacher.experienceYears} year${teacher.experienceYears === 1 ? "" : "s"}` : "—"}
              </InfoItem>
              <InfoItem icon={Plane} label="Leave group">
                {balance.policy?.name ?? "School-wide allowance"}
              </InfoItem>
              <InfoItem icon={BookOpen} label="Subjects">
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
        </div>

        <div className="space-y-6 xl:col-span-2">
          <Card title="Edit my details" icon={Pencil} description="Keep your contact details up to date so the school can reach you.">
            <MyProfileForm
              key={JSON.stringify([
                teacher.phone,
                teacher.whatsappNumber,
                teacher.email,
                teacher.address,
                teacher.bloodGroup,
                teacher.qualification,
                teacher.photoId,
              ])}
              action={updateMyProfile}
              photoUrl={photo}
              values={{
                phone: teacher.phone,
                whatsappNumber: teacher.whatsappNumber,
                email: teacher.email,
                address: teacher.address,
                bloodGroup: teacher.bloodGroup,
                qualification: teacher.qualification,
              }}
            />
          </Card>
          <Card title="Kept by the school" icon={Lock}>
            <p className="text-sm text-muted">
              Your name, employee ID, date of birth, gender, specialization, joining date, classes, subjects, salary and sign-in username are managed by your
              school admin. Ask them if any of these need correcting.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
