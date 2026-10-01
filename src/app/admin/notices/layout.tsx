import { after } from "next/server";
import { PageHeader } from "@/components/ui";
import { sendDueNotices } from "@/lib/messaging/server";
import { getCurrentSchool } from "@/lib/school";
import { NoticesTabs } from "./notices-tabs";

export default async function NoticesLayout({ children }: LayoutProps<"/admin/notices">) {
  const school = await getCurrentSchool();
  // Catch up on scheduled notices that are due (the daily job normally sends them).
  after(() => sendDueNotices(40, school.id));
  return (
    <>
      <PageHeader title="Notices" subtitle="Send notices to parents, teachers and staff by WhatsApp or SMS, now or on a chosen date." />
      <NoticesTabs />
      {children}
    </>
  );
}
