import { PageHeader } from "@/components/ui";
import { getCurrentSchool } from "@/lib/school";
import { NoticesTabs } from "./notices-tabs";

export default async function NoticesLayout({ children }: LayoutProps<"/admin/notices">) {
  await getCurrentSchool();
  return (
    <>
      <PageHeader title="Notices" subtitle="Send messages to parents by WhatsApp or SMS." />
      <NoticesTabs />
      {children}
    </>
  );
}
