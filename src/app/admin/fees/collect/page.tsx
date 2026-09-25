import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Card, EmptyState, PersonCell, Table, buttonVariants, inputClass, selectClass, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, outstandingByStudent } from "@/lib/fees";
import { rupees } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";

/** Find a student (by name, ID, father's name or phone) or open a class, then collect. */
export default async function CollectPage({ searchParams }: PageProps<"/admin/fees/collect">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sectionId = typeof sp.section === "string" ? sp.section : "";
  const { school } = await getFeesAccess();

  const sections = await db.section.findMany({
    where: { class: { schoolId: school.id } },
    orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
    include: { class: true },
  });
  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { studentCode: { contains: q, mode: "insensitive" as const } },
          { fatherName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
        ],
      }
    : sectionId
      ? { sectionId }
      : null;
  const students = where
    ? await db.student.findMany({
        where: { ...where, schoolId: school.id, status: "ACTIVE" },
        orderBy: [{ section: { class: { sortOrder: "asc" } } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
        take: 60,
        include: { section: { include: { class: true } } },
      })
    : [];
  const dues = students.length ? await outstandingByStudent(school.id, { id: { in: students.map((s) => s.id) } }) : new Map();

  return (
    <div className="space-y-6">
      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/admin/fees/collect">
          <label className="block min-w-60 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Find a student</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} placeholder="Name, student ID, father's name or phone" autoFocus className={`${inputClass} pl-9`} />
            </span>
          </label>
          <span className="pb-2.5 text-sm text-slate-400">or</span>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Class</span>
            <select name="section" defaultValue={sectionId} className={`${selectClass} !w-48`}>
              <option value="">Choose…</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {sectionLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonVariants.primary}>
            Show
          </button>
        </form>
      </Card>

      {where && (
        <Card padded={false} title={q ? `Results for “${q}”` : sectionLabel(sections.find((s) => s.id === sectionId) ?? { name: "", class: { name: "Class" } })} description={`${students.length} student(s)`}>
          {students.length === 0 ? (
            <EmptyState icon={Users} title="No students found" description="Try part of the name, the student ID or a phone number." />
          ) : (
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Class</th>
                  <th className={thClass}>Father</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Due now</th>
                  <th className={thClass}>
                    <span className="sr-only">Collect</span>
                  </th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {students.map((s) => {
                  const d = dues.get(s.id);
                  return (
                    <tr key={s.id} className={trClass}>
                      <td className={tdClass}>
                        <PersonCell name={fullName(s)} href={`/admin/fees/students/${s.id}`} sub={`${s.studentCode}${s.rollNumber != null ? ` · Roll ${s.rollNumber}` : ""}`} size="sm" />
                      </td>
                      <td className={tdClass}>{s.section ? sectionLabel(s.section) : "—"}</td>
                      <td className={tdClass}>{s.fatherName ?? "—"}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{d ? rupees(d.paid) : "—"}</td>
                      <td className={`${tdClass} text-right font-semibold tabular-nums ${d?.dueNow ? "text-rose-600" : "text-emerald-600"}`}>
                        {d ? (d.dueNow ? rupees(d.dueNow) : "Clear") : "—"}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Link href={`/admin/fees/students/${s.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                          Collect
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
