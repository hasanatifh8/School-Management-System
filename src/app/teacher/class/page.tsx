import Link from "next/link";
import { redirect } from "next/navigation";
import { Hash, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ListToolbar, SearchBox } from "@/components/list-toolbar";
import { Badge, Card, EmptyState, PageHeader, PersonCell, Table, buttonVariants, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
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
  const q = typeof (await searchParams).q === "string" ? String((await searchParams).q).trim() : "";
  const words = q.split(/\s+/).filter(Boolean);

  const students = await db.student.findMany({
    where: {
      sectionId: ctx.classSection.id,
      status: "ACTIVE",
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
    },
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
  });
  const missing = students.filter((s) => s.rollNumber == null).length;

  return (
    <>
      <PageHeader
        title={`My class · ${sectionLabel(ctx.classSection)}`}
        subtitle={`${students.length} student(s)${q ? " matching your search" : ""}`}
        breadcrumbs={[{ label: "Dashboard", href: "/teacher" }, { label: "My class" }]}
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <ListToolbar>
            <SearchBox placeholder="Name, ID or father's name…" />
          </ListToolbar>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <Hash className="h-4 w-4" />
              {missing ? <Badge tone="amber" dot>{missing} without roll no.</Badge> : <Badge tone="green" dot>roll numbers set</Badge>}
            </span>
            {missing > 0 && missing < students.length && (
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
          <EmptyState icon={Users} title={q ? "No students match your search" : "No students in your class yet"} />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Roll</th>
                <th className={thClass}>Student</th>
                <th className={thClass}>Gender</th>
                <th className={thClass}>Date of birth</th>
                <th className={thClass}>Father</th>
                <th className={thClass}>Phone</th>
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
                  <td className={tdClass}>{s.gender ? GENDER[s.gender] : "—"}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{s.dateOfBirth ? dob.format(s.dateOfBirth) : "—"}</td>
                  <td className={tdClass}>{s.fatherName ?? "—"}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{s.phone ?? "—"}</td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/teacher/students/${s.id}`} className={buttonVariants.ghost}>
                      View
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
