import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar, Card, EmptyState, PagedTable, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

/** How many periods each teacher has a week, with a link to their timetable. */
export default async function TeacherLoadPage() {
  const school = await getCurrentSchool();
  const [teachers, load] = await Promise.all([
    db.teacher.findMany({ where: { schoolId: school.id, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    db.timetableSlot.groupBy({ by: ["teacherId"], where: { section: { class: { schoolId: school.id } }, teacherId: { not: null } }, _count: true }),
  ]);
  const periods = new Map(load.map((l) => [l.teacherId, l._count]));

  return (
    <Card title="Teacher timetables" icon={Users} description="Periods per week, from every class timetable." padded={false}>
      {teachers.length === 0 ? (
        <EmptyState icon={Users} title="No teachers yet" />
      ) : (
        <PagedTable
          noun="teachers"
          pageSize={15}
          theadClassName={theadClass}
          tbodyClassName={tbodyClass}
          head={
            <tr>
              <th className={thClass}>Teacher</th>
              <th className={`${thClass} text-right`}>Periods a week</th>
              <th className={thClass}>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          }
        >
          {teachers.map((t) => (
            <tr key={t.id} className={trClass}>
              <td className={tdClass}>
                <span className="flex items-center gap-3">
                  <Avatar name={fullName(t)} src={photoUrl(t.photoId)} size="sm" />
                  <span>
                    <span className="block font-medium text-fg">{fullName(t)}</span>
                    {t.specialization && <span className="block text-xs text-muted">{t.specialization}</span>}
                  </span>
                </span>
              </td>
              <td className={`${tdClass} text-right font-semibold tabular-nums text-fg`}>{periods.get(t.id) ?? 0}</td>
              <td className={`${tdClass} text-right`}>
                <Link href={`/admin/timetable/teachers/${t.id}`} className="font-medium text-accent-text hover:underline">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </PagedTable>
      )}
    </Card>
  );
}
