import Link from "next/link";
import { GraduationCap, Pencil, Search, UserPlus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, getHouses, sectionLabel } from "@/lib/queries";
import { HouseBadge } from "@/components/house";
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
  selectClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const school = await getCurrentSchool();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const classId = typeof params.classId === "string" ? params.classId : "";
  const houseId = typeof params.houseId === "string" ? params.houseId : "";
  const showRemoved = params.status === "removed";

  const filters: Prisma.StudentWhereInput = {
    schoolId: school.id,
    ...(classId && { section: { classId } }),
    ...(houseId && { houseId: houseId === "none" ? null : houseId }),
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { middleName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { studentCode: { contains: q, mode: "insensitive" } },
        { fatherName: { contains: q, mode: "insensitive" } },
        { motherName: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [students, activeCount, removedCount, classes, houses] = await Promise.all([
    db.student.findMany({
      where: { ...filters, status: showRemoved ? "INACTIVE" : "ACTIVE" },
      // Within a class, list by section and roll number; otherwise by student ID.
      orderBy: classId
        ? [{ section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }]
        : { studentCode: "asc" },
      include: { section: { include: { class: true } }, house: true, _count: { select: { subjects: true } } },
    }),
    db.student.count({ where: { ...filters, status: "ACTIVE" } }),
    db.student.count({ where: { ...filters, status: "INACTIVE" } }),
    getClassesWithSections(school.id),
    getHouses(school.id),
  ]);

  const tabHref = (removed: boolean) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (classId) sp.set("classId", classId);
    if (houseId) sp.set("houseId", houseId);
    if (removed) sp.set("status", "removed");
    const s = sp.toString();
    return `/admin/students${s ? `?${s}` : ""}`;
  };
  const filtered = Boolean(q || classId || houseId);

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Admissions, class placement and parent contacts"
        action={
          <ButtonLink href="/admin/students/new" icon={UserPlus}>
            Add student
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
                placeholder="Name, student ID or parent…"
                className={`${inputClass} !w-full !py-2 pl-9 sm:!w-64`}
              />
            </div>
            <select name="classId" defaultValue={classId} className={`${selectClass} !w-40 !py-2`}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {houses.length > 0 && (
              <select name="houseId" defaultValue={houseId} className={`${selectClass} !w-40 !py-2`}>
                <option value="">All houses</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
                <option value="none">No house</option>
              </select>
            )}
            <button className={`${buttonVariants.secondary} !py-2`}>Apply</button>
            {filtered && (
              <Link
                href={showRemoved ? "/admin/students?status=removed" : "/admin/students"}
                className={buttonVariants.ghost}
              >
                Clear
              </Link>
            )}
          </form>
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
