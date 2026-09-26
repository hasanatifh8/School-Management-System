import Link from "next/link";
import { Crown, FileSpreadsheet, Pencil, Phone, Presentation, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { ExportDialog } from "@/components/export-dialog";
import { Pagination } from "@/components/pagination";
import { paginate } from "@/lib/pagination";
import { FilterSelect, ListToolbar, ResetFilters, SearchBox } from "@/components/list-toolbar";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { parseTeacherFilters, teacherWhere } from "@/lib/list-filters";
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
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";

export default async function TeachersPage({ searchParams }: PageProps<"/admin/teachers">) {
  const school = await getCurrentSchool();
  const params = await searchParams;
  const f = parseTeacherFilters(params);
  const filters = teacherWhere(school.id, f);
  const showRemoved = f.removed;

  const [activeCount, removedCount, subjects] = await Promise.all([
    db.teacher.count({ where: { ...filters, status: "ACTIVE" } }),
    db.teacher.count({ where: { ...filters, status: "INACTIVE" } }),
    db.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const paging = paginate(params, showRemoved ? removedCount : activeCount);
  const teachers = await db.teacher.findMany({
    where: { ...filters, status: showRemoved ? "INACTIVE" : "ACTIVE" },
    orderBy: { employeeCode: "asc" },
    skip: paging.skip,
    take: paging.take,
    include: {
      classTeacherOf: { include: { class: true } },
      subjectAssignments: { include: { subject: true } },
    },
  });

  // Tabs keep the current search and filters.
  const tabHref = (removed: boolean) => {
    const sp = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v && k !== "status" && k !== "page" ? [[k, v]] : [])),
    );
    if (removed) sp.set("status", "removed");
    const qs = sp.toString();
    return `/admin/teachers${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(f.q || f.role || f.subjectId || f.gender || f.bloodGroup);

  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Teaching staff, class teachers and subject assignments"
        action={
          <>
            <ExportDialog kind="teachers" count={paging.total} noun="teachers" />
            <ButtonLink href="/admin/teachers/import" icon={FileSpreadsheet} variant="secondary">
              Bulk upload
            </ButtonLink>
            <ButtonLink href="/admin/teachers/new" icon={UserPlus}>
              Add teacher
            </ButtonLink>
          </>
        }
      />

      <Card padded={false}>
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 pt-4">
          <div className="-mb-px flex gap-6 text-sm font-medium">
            <StatusTab href={tabHref(false)} active={!showRemoved} label="Active" count={activeCount} />
            <StatusTab href={tabHref(true)} active={showRemoved} label="Removed" count={removedCount} />
          </div>
          <div className="pb-4">
            <ListToolbar>
              <SearchBox placeholder="Name, ID, phone, email or subject…" />
              <FilterSelect
                name="role"
                label="Any role"
                options={[
                  { value: "class", label: "Class teachers" },
                  { value: "subject", label: "Subject teachers" },
                  { value: "none", label: "No assignments" },
                ]}
              />
              <FilterSelect
                name="subjectId"
                label="Any subject"
                options={subjects.map((sub) => ({ value: sub.id, label: `Teaches ${sub.name}` }))}
              />
              <FilterSelect
                name="gender"
                label="Any gender"
                options={[
                  { value: "MALE", label: "Male" },
                  { value: "FEMALE", label: "Female" },
                  { value: "OTHER", label: "Other" },
                ]}
              />
              <FilterSelect
                name="bloodGroup"
                label="Any blood group"
                options={BLOOD_GROUPS.map((b) => ({ value: b, label: BLOOD_GROUP_LABELS[b] }))}
              />
              <ResetFilters keys={["q", "role", "subjectId", "gender", "bloodGroup"]} />
            </ListToolbar>
          </div>
        </div>

        {teachers.length === 0 ? (
          <EmptyState
            icon={Presentation}
            title={filtered ? "No teachers match your filters" : showRemoved ? "No removed teachers" : "No teachers yet"}
            description={
              filtered
                ? "Try a different search or reset the filters."
                : showRemoved
                  ? "Teachers you remove will appear here and can be restored."
                  : "Add teachers, then assign them as class or subject teachers from each class."
            }
            action={
              !filtered && !showRemoved ? (
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
                            {(t.specialization ?? t.qualification) && <> · {t.specialization ?? t.qualification}</>}
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
        <Pagination paging={paging} noun="teachers" />
      </Card>
    </>
  );
}
