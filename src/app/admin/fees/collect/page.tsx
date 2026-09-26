import Link from "next/link";
import { ChevronRight, HandCoins, SearchX, Users } from "lucide-react";
import { FilterSelect, ListToolbar, ResetFilters, SearchBox } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import {
  ButtonLink,
  Card,
  Dash,
  EmptyState,
  PersonCell,
  SpotIllustration,
  Table,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, outstandingByStudent } from "@/lib/fees";
import { rupees } from "@/lib/fees-shared";
import { paginate } from "@/lib/pagination";
import { fullName, sectionLabel } from "@/lib/queries";

/**
 * Find a student (by name, ID, father's name or phone) or open a class, then
 * collect. Search runs as you type; results are paged.
 */
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
  const searching = Boolean(q || sectionId);
  const where = {
    schoolId: school.id,
    status: "ACTIVE" as const,
    ...(sectionId ? { sectionId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { studentCode: { contains: q, mode: "insensitive" as const } },
            { fatherName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
  const total = searching ? await db.student.count({ where }) : 0;
  const paging = paginate(sp, total);
  const students = searching
    ? await db.student.findMany({
        where,
        orderBy: [
          { section: { class: { sortOrder: "asc" } } },
          { rollNumber: { sort: "asc", nulls: "last" } },
          { firstName: "asc" },
          { id: "asc" },
        ],
        skip: paging.skip,
        take: paging.take,
        include: { section: { include: { class: true } } },
      })
    : [];
  const dues = students.length ? await outstandingByStudent(school.id, { id: { in: students.map((s) => s.id) } }) : new Map();
  const section = sections.find((s) => s.id === sectionId);

  return (
    <Card padded={false}>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <ListToolbar>
          <SearchBox placeholder="Name, student ID, father's name or phone…" />
          <FilterSelect name="section" label="Any class" options={sections.map((s) => ({ value: s.id, label: sectionLabel(s) }))} />
          <ResetFilters keys={["q", "section"]} />
        </ListToolbar>
      </div>

      {!searching ? (
        <div className="px-4 py-12 text-center sm:px-6">
          <SpotIllustration icon={HandCoins} />
          <p className="mt-4 text-base font-semibold text-fg">Who is paying today?</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Start typing a name, ID or phone number above — or jump straight to a class.</p>
          {sections.length > 0 && (
            <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
              {sections.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/fees/collect?section=${s.id}`}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-fg-2 shadow-card transition hover:-translate-y-px hover:border-accent-line hover:text-accent-text"
                >
                  {sectionLabel(s)}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : students.length === 0 ? (
        <EmptyState icon={q ? SearchX : Users} title="No students found" description="Try part of the name, the student ID or a phone number." />
      ) : (
        <>
          <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted sm:px-6">
            {q ? <>Results for “{q}”</> : section ? sectionLabel(section) : "Students"}
            {q && section && <> in {sectionLabel(section)}</>} · {total.toLocaleString("en-IN")} student(s)
          </p>
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Student</th>
                <th className={`${thClass} hidden md:table-cell`}>Class</th>
                <th className={`${thClass} hidden lg:table-cell`}>Father</th>
                <th className={`${thClass} hidden text-right sm:table-cell`}>Paid</th>
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
                      <PersonCell
                        name={fullName(s)}
                        href={`/admin/fees/students/${s.id}`}
                        sub={`${s.studentCode}${s.rollNumber != null ? ` · Roll ${s.rollNumber}` : ""}`}
                        size="sm"
                      />
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>{s.section ? sectionLabel(s.section) : <Dash />}</td>
                    <td className={`${tdClass} hidden lg:table-cell`}>{s.fatherName ?? <Dash />}</td>
                    <td className={`${tdClass} hidden text-right tabular-nums sm:table-cell`}>{d ? rupees(d.paid) : <Dash />}</td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums ${d?.dueNow ? "text-danger" : "text-success"}`}>
                      {d ? (d.dueNow ? rupees(d.dueNow) : "Clear") : <Dash />}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {d?.dueNow ? (
                        <ButtonLink href={`/admin/fees/students/${s.id}`} size="sm" icon={HandCoins}>
                          Collect
                        </ButtonLink>
                      ) : (
                        <ButtonLink href={`/admin/fees/students/${s.id}`} size="sm" variant="ghost">
                          View
                          <ChevronRight className="h-4 w-4" />
                        </ButtonLink>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination paging={paging} noun="students" />
        </>
      )}
    </Card>
  );
}
