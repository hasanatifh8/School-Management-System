import Link from "next/link";
import { FileSpreadsheet, GraduationCap, Pencil, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, getHouses, sectionLabel } from "@/lib/queries";
import { HouseBadge } from "@/components/house";
import { ExportDialog } from "@/components/export-dialog";
import { FilterSelect, ListToolbar, ResetFilters, SearchBox } from "@/components/list-toolbar";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { parseStudentFilters, studentOrder, studentWhere } from "@/lib/list-filters";
import { CATEGORY_LABELS } from "@/lib/student-options";
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

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const school = await getCurrentSchool();
  const params = await searchParams;
  const f = parseStudentFilters(params);
  const filters = studentWhere(school.id, f);
  const showRemoved = f.removed;

  const [students, activeCount, removedCount, classes, houses] = await Promise.all([
    db.student.findMany({
      where: { ...filters, status: showRemoved ? "INACTIVE" : "ACTIVE" },
      orderBy: studentOrder(f),
      include: { section: { include: { class: true } }, house: true, _count: { select: { subjects: true } } },
    }),
    db.student.count({ where: { ...filters, status: "ACTIVE" } }),
    db.student.count({ where: { ...filters, status: "INACTIVE" } }),
    getClassesWithSections(school.id),
    getHouses(school.id),
  ]);

  // Tabs keep the current search and filters.
  const tabHref = (removed: boolean) => {
    const sp = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v && k !== "status" ? [[k, v]] : [])),
    );
    if (removed) sp.set("status", "removed");
    const qs = sp.toString();
    return `/admin/students${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(f.q || f.classId || f.sectionId || f.houseId || f.gender || f.category || f.bloodGroup);
  const sections = classes.find((c) => c.id === f.classId)?.sections ?? [];

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Admissions, class placement and parent contacts"
        action={
          <>
            <ExportDialog kind="students" count={students.length} noun="students" />
            <ButtonLink href="/admin/students/import" icon={FileSpreadsheet} variant="secondary">
              Bulk upload
            </ButtonLink>
            <ButtonLink href="/admin/students/new" icon={UserPlus}>
              Add student
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
              <SearchBox placeholder="Name, ID, parent or phone…" />
              <FilterSelect
                name="classId"
                label="All classes"
                resets={["sectionId"]}
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
              {sections.length > 1 && (
                <FilterSelect
                  name="sectionId"
                  label="All sections"
                  options={sections.map((sec) => ({ value: sec.id, label: `Section ${sec.name}` }))}
                />
              )}
              {houses.length > 0 && (
                <FilterSelect
                  name="houseId"
                  label="All houses"
                  options={[...houses.map((h) => ({ value: h.id, label: h.name })), { value: "none", label: "No house" }]}
                />
              )}
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
                name="category"
                label="Any category"
                options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <FilterSelect
                name="bloodGroup"
                label="Any blood group"
                options={BLOOD_GROUPS.map((b) => ({ value: b, label: BLOOD_GROUP_LABELS[b] }))}
              />
              <ResetFilters keys={["q", "classId", "sectionId", "houseId", "gender", "category", "bloodGroup"]} />
            </ListToolbar>
          </div>
        </div>

        {students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={filtered ? "No students match your filters" : showRemoved ? "No removed students" : "No students yet"}
            description={
              filtered
                ? "Try a different name, ID or class."
                : showRemoved
                  ? "Students you remove will appear here and can be restored."
                  : "Add your first student to get started."
            }
            action={
              !filtered && !showRemoved ? (
                <ButtonLink href="/admin/students/new" icon={UserPlus}>
                  Add student
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Student</th>
                <th className={thClass}>Class</th>
                <th className={thClass}>Roll</th>
                <th className={thClass}>House</th>
                <th className={thClass}>Parents</th>
                <th className={thClass}>Subjects</th>
                <th className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {students.map((s) => (
                <tr key={s.id} className={trClass}>
                  <td className={tdClass}>
                    <PersonCell
                      name={fullName(s)}
                      href={`/admin/students/${s.id}`}
                      photoUrl={photoUrl(s.photoId)}
                      sub={<span className="font-mono">{s.studentCode}</span>}
                    />
                  </td>
                  <td className={tdClass}>
                    {s.section ? (
                      <Badge tone="indigo">{sectionLabel(s.section)}</Badge>
                    ) : (
                      <Badge tone="amber" dot>
                        Not assigned
                      </Badge>
                    )}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {s.rollNumber ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className={tdClass}>
                    {s.house ? <HouseBadge house={s.house} /> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className={tdClass}>
                    <div className="space-y-0.5 text-xs">
                      <ParentLine label="Father" name={s.fatherName} />
                      <ParentLine label="Mother" name={s.motherName} />
                      {!s.fatherName && !s.motherName && (
                        <span className="text-slate-400">Not added</span>
                      )}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-semibold text-slate-700 tabular-nums">
                      {s._count.subjects}
                    </span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/admin/students/${s.id}`} className={buttonVariants.ghost}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function ParentLine({ label, name }: { label: string; name: string | null }) {
  if (!name) return null;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="w-12 text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{name}</span>
    </div>
  );
}
