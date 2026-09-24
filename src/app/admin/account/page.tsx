import { redirect } from "next/navigation";
import { Card, InfoItem, PageHeader } from "@/components/ui";
import { CalendarDays, Mail, School, UserRound } from "lucide-react";
import { getViewer } from "@/lib/school";
import { ChangePasswordForm } from "./password-form";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.kind === "power") {
    return (
      <>
        <PageHeader title="Account" />
        <Card>
          <p className="text-sm text-slate-600">
            You are signed in as Power Admin. School admin accounts are managed from each school&apos;s page in Power Admin.
          </p>
        </Card>
      </>
    );
  }
  const { admin } = viewer;
  return (
    <>
      <PageHeader title="Account" subtitle="Your sign-in details for the Admin Portal." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Profile" className="self-start">
          <dl className="space-y-4">
            <InfoItem icon={UserRound} label="Name">{admin.name}</InfoItem>
            <InfoItem icon={Mail} label="Email (sign-in)">{admin.email}</InfoItem>
            <InfoItem icon={School} label="School">{admin.school.name}</InfoItem>
            <InfoItem icon={CalendarDays} label="Last sign-in">
              {admin.lastLoginAt ? when.format(admin.lastLoginAt) : "—"}
            </InfoItem>
          </dl>
          <p className="mt-4 text-xs text-slate-500">To change your name or email, ask your Power Admin.</p>
        </Card>
        <Card title="Change password" description="Other devices are signed out when you change it." className="xl:col-span-2">
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
