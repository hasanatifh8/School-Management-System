import { NoticeList } from "@/components/notices/notice-detail";
import { Card } from "@/components/ui";
import { getCurrentSchool } from "@/lib/school";

export default async function SentNoticesPage({ searchParams }: PageProps<"/admin/notices/sent">) {
  const school = await getCurrentSchool();
  return (
    <Card title="Sent notices" description="From admins and class teachers, newest first." padded={false}>
      <NoticeList where={{ schoolId: school.id }} href={(id) => `/admin/notices/${id}`} params={await searchParams} />
    </Card>
  );
}
