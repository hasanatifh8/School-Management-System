import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Hash, SearchX, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ListToolbar, SearchBox } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { Badge, Card, Dash, EmptyState, PageHeader, PersonCell, Table, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";
import { assignMyClassRollNumbers } from "../actions";

const dob = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const GENDER: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

export default async function MyClassPage({ searchParams }: PageProps<"/teacher/class">) {
  const ctx = await requireTeacher();
  if (!ctx.classSection) redirect("/teacher");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const words = q.split(/\s+/).filter(Boolean);

  const where = {
    sectionId: ctx.classSection.id,
    status: "ACTIVE" as const,
    ...(words.length && {
      AND: words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: "insensitive" as const } },
          { lastName: { contains: w, mode: "insensitive" as const } },
          { studentCode: { contains: w, mode: "insensitive" as const } },
          { fatherName: { contains: w, mode: "insensitive" as const } },
        ],
      })),
    }),
  };
  const [total, missing] = await Promise.all([
    db.student.count({ where }),
    db.student.count({ where: { ...where, rollNumber: null } }),
  ]);
  const paging = paginate(params, total);
  const students = await db.student.findMany({
    where,
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }, { id: "asc" }],
    skip: paging.skip,
    take: paging.take,
  });

  return (
    <>
      <PageHeader
        title={`My class · ${sectionLabel(ctx.classSection)}`}
        subtitle={`${total} student(s)${q ? " matching your search" : ""}`}
        breadcrumbs={[{ label: "Dashboard", href: "/teacher" }, { label: "My class" }]}
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <ListToolbar>
            <SearchBox placeholder="Name, ID or father's name…" />
          </ListToolbar>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Hash className="h-4 w-4" />
              {missing ? <Badge tone="amber" dot>{missing} without roll no.</Badge> : <Badge tone="green" dot>roll numbers set</Badge>}
            </span>
            {missing > 0 && missing < total && (
              <ActionForm action={assignMyClassRollNumbers.bind(null, "missing")} compact className="flex flex-row-reverse items-center gap-2">
                <SubmitButton variant="ghost" size="sm">
                  Fill missing
                </SubmitButton>
              </ActionForm>
            )}
            <ActionForm action={assignMyClassRollNumbers.bind(null, "all")} compact className="flex flex-row-reverse items-center gap-2">
              <SubmitButton variant="secondary" size="sm" confirm="Number every student from 1 in A–Z order? Existing roll numbers are replaced.">
                Auto-assign roll numbers
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
        {students.length === 0 ? (
          <EmptyState icon={q ? SearchX : Users} title={q ? "No students match your search" : "No students in your class yet"} />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Roll</th>
                <th className={thClass}>Student</th>
                <th className={`${thClass} hidden md:table-cell`}>Gender</th>
                <th className={`${thClass} hidden lg:table-cell`}>Date of birth</th>
                <th className={`${thClass} hidden md:table-cell`}>Father</th>
                <th className={`${thClass} hidden sm:table-cell`}>Phone</th>
                <th className={thClass}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {students.map((s) => (
                <tr key={s.id} className={trClass}>
                  <td className={`${tdClass} w-14 tabular-nums font-medium`}>{s.rollNumber ?? "—"}</td>
                  <td className={tdClass}>
                    <PersonCell name={fullName(s)} href={`/teacher/students/${s.id}`} photoUrl={photoUrl(s.photoId)} sub={<span className="font-mono">{s.studentCode}</span>} />
                  </td>
                  <td className={`${tdClass} hidden md:table-cell`}>{s.gender ? GENDER[s.gender] : <Dash />}</td>
                  <td className={`${tdClass} hidden whitespace-nowrap lg:table-cell`}>{s.dateOfBirth ? dob.format(s.dateOfBirth) : <Dash />}</td>
                  <td className={`${tdClass} hidden md:table-cell`}>{s.fatherName ?? <Dash />}</td>
                  <td className={`${tdClass} hidden whitespace-nowrap sm:table-cell`}>
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="rounded text-accent-text underline-offset-4 hover:underline">
                        {s.phone}
                      </a>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link
                      href={`/teacher/students/${s.id}`}
                      aria-label={`Open ${fullName(s)}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-surface-3 hover:text-accent-text"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination paging={paging} noun="students" />
      </Card>
    </>
  );
}
