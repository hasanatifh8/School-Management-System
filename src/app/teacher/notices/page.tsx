import { Megaphone } from "lucide-react";
import { NoticeComposer } from "@/components/notices/notice-composer";
import { NoticeList } from "@/components/notices/notice-detail";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { previewNotice, sendNotice } from "@/app/admin/notices/actions";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { loadMessaging } from "@/lib/messaging/server";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

/** A class teacher messages their class's parents. */
export default async function TeacherNoticesPage({ searchParams }: PageProps<"/teacher/notices">) {
  const absent = (await searchParams).absent;
  const ctx = await requireTeacher();
  const messaging = await loadMessaging(ctx.school.id);
  const blocked = !ctx.classSection ? "Only class teachers can send notices." : !messaging.teachersCanSend ? "The school admin has turned off notices from teachers." : !messaging.WHATSAPP.ready && !messaging.SMS.ready ? "WhatsApp and SMS aren't set up yet. Ask the school admin." : null;
  const students = ctx.classSection
    ? await db.student.findMany({
        where: { sectionId: ctx.classSection.id, status: "ACTIVE" },
        orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
        select: { id: true, firstName: true, middleName: true, lastName: true, rollNumber: true, phone: true, whatsappNumber: true },
      })
    : [];
  return (
    <>
      <PageHeader title="Notices" subtitle={ctx.classSection ? `Message the parents of ${sectionLabel(ctx.classSection)} by WhatsApp or SMS.` : undefined} />
      {blocked ? (
        <Card>
          <EmptyState icon={Megaphone} title="Can't send notices" description={blocked} />
        </Card>
      ) : (
        <NoticeComposer
          mode="teacher"
          students={students.map((s) => ({ id: s.id, name: fullName(s), className: s.rollNumber != null ? `Roll ${s.rollNumber}` : "", hasPhone: !!(s.phone || s.whatsappNumber) }))}
          channels={{ WHATSAPP: messaging.WHATSAPP.ready, SMS: messaging.SMS.ready }}
          today={todayISO()}
          absentDate={typeof absent === "string" && /^\d{4}-\d{2}-\d{2}$/.test(absent) ? absent : undefined}
      preview={previewNotice}
          send={sendNotice}
        />
      )}
      <h2 className="mb-4 mt-10 text-lg font-semibold text-slate-900">My sent notices</h2>
      <Card padded={false}>
        <NoticeList where={{ schoolId: ctx.school.id, teacherId: ctx.teacher.id }} href={(id) => `/teacher/notices/${id}`} />
      </Card>
    </>
  );
}

// Sending continues in the background (after()) for up to this long.
export const maxDuration = 60;
