import { NoticeComposer } from "@/components/notices/notice-composer";
import { todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { loadMessaging } from "@/lib/messaging/server";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { previewNotice, sendNotice } from "./actions";

export default async function SendNoticePage({ searchParams }: PageProps<"/admin/notices">) {
  const absent = (await searchParams).absent;
  const school = await getCurrentSchool();
  const [messaging, sections, students] = await Promise.all([
    loadMessaging(school.id),
    db.section.findMany({
      where: { class: { schoolId: school.id } },
      orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
      include: { class: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
    }),
    db.student.findMany({
      where: { schoolId: school.id, status: "ACTIVE" },
      orderBy: [{ section: { class: { sortOrder: "asc" } } }, { firstName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, phone: true, whatsappNumber: true, section: { include: { class: true } } },
    }),
  ]);
  return (
    <NoticeComposer
      mode="admin"
      sections={sections.map((s) => ({ id: s.id, label: sectionLabel(s), count: s._count.students }))}
      students={students.map((s) => ({ id: s.id, name: fullName(s), className: s.section ? sectionLabel(s.section) : "No class", hasPhone: !!(s.phone || s.whatsappNumber) }))}
      channels={{ WHATSAPP: messaging.WHATSAPP.ready, SMS: messaging.SMS.ready }}
      today={todayISO()}
      absentDate={typeof absent === "string" && /^\d{4}-\d{2}-\d{2}$/.test(absent) ? absent : undefined}
      preview={previewNotice}
      send={sendNotice}
    />
  );
}

// Sending continues in the background (after()) for up to this long.
export const maxDuration = 60;
