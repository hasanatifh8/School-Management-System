import Link from "next/link";
import { Crown, Pencil, Phone, Presentation, Search, UserPlus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  PersonCell,
  StatusTab,
  Table,
  buttonVariants,
  inputClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";

export default async function TeachersPage({ searchParams }: PageProps<"/admin/teachers">) {
  const school = await getCurrentSchool();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const showRemoved = params.status === "removed";

  const filters: Prisma.TeacherWhereInput = {
    schoolId: school.id,
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { employeeCode: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [teachers, activeCount, removedCount] = await Promise.all([
    db.teacher.findMany({
      where: { ...filters, status: showRemoved ? "INACTIVE" : "ACTIVE" },
      orderBy: { employeeCode: "asc" },
      include: {
        classTeacherOf: { include: { class: true } },
        subjectAssignments: { include: { subject: true } },
      },
    }),
    db.teacher.count({ where: { ...filters, status: "ACTIVE" } }),
    db.teacher.count({ where: { ...filters, status: "INACTIVE" } }),
  ]);

  const tabHref = (removed: boolean) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (removed) sp.set("status", "removed");
    const s = sp.toString();
    return `/admin/teachers${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Teaching staff, class teachers and subject assignments"
        action={
          <ButtonLink href="/admin/teachers/new" icon={UserPlus}>
            Add teacher
          </ButtonLink>
        }
      />

      <Card padded={false}>
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="-mb-px flex gap-6 text-sm font-medium">
            <StatusTab href={tabHref(false)} active={!showRemoved} label="Active" count={activeCount} />
            <StatusTab href={tabHref(true)} active={showRemoved} label="Removed" count={removedCount} />
          </div>
          <form className="flex flex-wrap items-center gap-2 pb-4">
            {showRemoved && <input type="hidden" name="status" value="removed" />}
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Name, teacher ID or phone…"
                className={`${inputClass} !w-full !py-2 pl-9 sm:!w-64`}
              />
            </div>
            <button className={`${buttonVariants.secondary} !py-2`}>Search</button>
            {q && (
              <Link
                href={showRemoved ? "/admin/teachers?status=removed" : "/admin/teachers"}
                className={buttonVariants.ghost}
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {teachers.length === 0 ? (
          <EmptyState
            icon={Presentation}
            title={q ? "No teachers match your search" : showRemoved ? "No removed teachers" : "No teachers yet"}
            description={
              q
                ? "Try a different name, ID or phone number."
                : showRemoved
                  ? "Teachers you remove will appear here and can be restored."
                  : "Add teachers, then assign them as class or subject teachers from each class."
            }
            action={
              !q && !showRemoved ? (
                <ButtonLink href="/admin/teachers/new" icon={UserPlus}>
                  Add teacher
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Teacher</th>
                <th className={thClass}>Class teacher</th>
                <th className={thClass}>Subjects taught</th>
                <th className={thClass}>Contact</th>
                <th className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {teachers.map((t) => {
                const subjects = [...new Set(t.subjectAssignments.map((a) => a.subject.name))];
                return (
                  <tr key={t.id} className={trClass}>
                    <td className={tdClass}>
                      <PersonCell
                        name={fullName(t)}
                        href={`/admin/teachers/${t.id}`}
                        photoUrl={photoUrl(t.photoId)}
                        sub={
                          <>
                            <span className="font-mono">{t.employeeCode}</span>
                            {t.qualification && <> · {t.qualification}</>}
                          </>
                        }
                      />
                    </td>
                    <td className={tdClass}>
                      {t.classTeacherOf ? (
                        <Badge tone="indigo">
                          <Crown className="h-3 w-3" />
                          {sectionLabel(t.classTeacherOf)}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      {subjects.length ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {subjects.map((s) => (
                            <Badge key={s}>{s}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      {t.phone ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {t.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link href={`/admin/teachers/${t.id}`} className={buttonVariants.ghost}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
