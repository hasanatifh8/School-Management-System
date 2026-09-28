import Link from "next/link";
import { Bell, Lock, School } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PagedTable, ProgressBar, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { getPeriods } from "@/lib/timetable";

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Every section's timetable: how full it is, who changed it last, and whether it is locked. */
export default async function TimetablesPage() {
  const school = await getCurrentSchool();
  const [periods, { timetableDays }, sections, filled] = await Promise.all([
    getPeriods(school.id),
    db.school.findUniqueOrThrow({ where: { id: school.id }, select: { timetableDays: true } }),
    db.section.findMany({
      where: { class: { schoolId: school.id } },
      orderBy: [{ class: { sortOrder: "asc" } }, { name: "asc" }],
      include: { class: true, classTeacher: true, timetable: true },
    }),
    db.timetableSlot.groupBy({ by: ["sectionId"], where: { section: { class: { schoolId: school.id } } }, _count: true }),
  ]);

  if (!periods.some((p) => !p.isBreak)) {
    return (
      <Card>
        <EmptyState
          icon={Bell}
          title="Set up the bell schedule first"
          description="Add the periods of a school day (and breaks) once. Then every class gets a weekly timetable to fill in."
          action={<ButtonLink href="/admin/timetable/periods">Set up periods</ButtonLink>}
        />
      </Card>
    );
  }

  const perWeek = periods.filter((p) => !p.isBreak).length * timetableDays.length;
  const count = new Map(filled.map((f) => [f.sectionId, f._count]));

  return (
    <Card title="Class timetables" icon={School} description={`${perWeek} periods a week per class`} padded={false}>
      {sections.length === 0 ? (
        <EmptyState icon={School} title="No classes yet" action={<ButtonLink href="/admin/classes">Create classes</ButtonLink>} />
      ) : (
        <PagedTable
          noun="classes"
          pageSize={15}
          theadClassName={theadClass}
          tbodyClassName={tbodyClass}
          head={
            <tr>
              <th className={thClass}>Class</th>
              <th className={thClass}>Class teacher</th>
              <th className={thClass}>Filled</th>
              <th className={thClass}>Last changed</th>
              <th className={thClass}>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          }
        >
          {sections.map((s) => {
            const n = count.get(s.id) ?? 0;
            return (
              <tr key={s.id} className={trClass}>
                <td className={`${tdClass} font-medium text-fg`}>
                  <span className="flex items-center gap-2">
                    {sectionLabel(s)}
                    {s.timetable?.locked && (
                      <Badge tone="amber">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    )}
                  </span>
                </td>
                <td className={tdClass}>{s.classTeacher ? fullName(s.classTeacher) : <span className="text-subtle">—</span>}</td>
                <td className={`${tdClass} w-48`}>
                  <span className="mb-1 block text-xs tabular-nums text-muted">
                    {n} / {perWeek}
                  </span>
                  <ProgressBar value={(n / perWeek) * 100} tone={n >= perWeek ? "success" : "accent"} label={`${sectionLabel(s)} timetable filled`} />
                </td>
                <td className={`${tdClass} text-xs text-muted`}>
                  {s.timetable?.updatedBy ? `${s.timetable.updatedBy}, ${when.format(s.timetable.updatedAt)}` : "Not started"}
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/admin/timetable/class/${s.id}`} className="font-medium text-accent-text hover:underline">
                    {n ? "Edit" : "Create"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </PagedTable>
      )}
    </Card>
  );
}
