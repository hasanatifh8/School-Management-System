import { notFound } from "next/navigation";
import { NoticeDetail } from "@/components/notices/notice-detail";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-auth";

export default async function TeacherNoticePage({ params }: PageProps<"/teacher/notices/[id]">) {
  const { id } = await params;
  const ctx = await requireTeacher();
  const notice = await db.notice.findFirst({ where: { id, schoolId: ctx.school.id, teacherId: ctx.teacher.id }, select: { id: true } });
  if (!notice) notFound();
  return (
    <>
      <PageHeader title="Notice" breadcrumbs={[{ label: "Notices", href: "/teacher/notices" }, { label: "Delivery" }]} />
      <NoticeDetail noticeId={notice.id} />
    </>
  );
}

// Sending continues in the background (after()) for up to this long.
export const maxDuration = 60;
