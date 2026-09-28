import { notFound } from "next/navigation";
import { NoticeDetail } from "@/components/notices/notice-detail";
import { Breadcrumbs } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";

export default async function NoticePage({ params }: PageProps<"/admin/notices/[id]">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const notice = await db.notice.findFirst({ where: { id, schoolId: school.id }, select: { id: true, title: true } });
  if (!notice) notFound();
  return (
    <>
      <Breadcrumbs items={[{ label: "Sent notices", href: "/admin/notices/sent" }, { label: notice.title }]} />
      <NoticeDetail noticeId={notice.id} />
    </>
  );
}

// Sending continues in the background (after()) for up to this long.
export const maxDuration = 60;
