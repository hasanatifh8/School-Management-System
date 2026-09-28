import Link from "next/link";
import { ChevronRight, Phone, SearchX, UserCog, UserPlus, Wallet } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { Pagination } from "@/components/pagination";
import { FilterSelect, ListToolbar, ResetFilters, SearchBox } from "@/components/list-toolbar";
import {
  Badge,
  ButtonLink,
  Card,
  Dash,
  EmptyState,
  PageHeader,
  PersonCell,
  StatusTab,
  Table,
  tabBarClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { rupees } from "@/lib/fees-shared";
import { paginate } from "@/lib/pagination";
import { photoUrl } from "@/lib/photos";
import { getCurrentSchool } from "@/lib/school";

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

/** Non-teaching staff (office, guards, helpers, drivers…). Cashiers among them can collect fees. */
export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const school = await getCurrentSchool();
  const params = await searchParams;
  const showRemoved = params.status === "removed";
  const q = str(params.q);
  const job = str(params.job);
  const access = str(params.access);

  const filters: Prisma.StaffMemberWhereInput = { schoolId: school.id };
  if (q) {
    filters.AND = q.split(/\s+/).map((w) => ({
      OR: [
        { name: { contains: w, mode: "insensitive" as const } },
        { employeeCode: { contains: w, mode: "insensitive" as const } },
        { designation: { contains: w, mode: "insensitive" as const } },
        { phone: { contains: w } },
        { email: { contains: w, mode: "insensitive" as const } },
      ],
    }));
  }
  if (job) filters.designation = { equals: job, mode: "insensitive" };
  if (access === "cashier") filters.cashierAccount = { isNot: null };
  if (access === "none") filters.cashierAccount = { is: null };

  const [activeCount, removedCount, jobs, payroll] = await Promise.all([
    db.staffMember.count({ where: { ...filters, status: "ACTIVE" } }),
    db.staffMember.count({ where: { ...filters, status: "INACTIVE" } }),
    db.staffMember.findMany({ where: { schoolId: school.id }, distinct: ["designation"], orderBy: { designation: "asc" }, select: { designation: true } }),
    db.staffMember.aggregate({ where: { schoolId: school.id, status: "ACTIVE" }, _sum: { monthlySalary: true }, _count: true }),
  ]);
  const paging = paginate(params, showRemoved ? removedCount : activeCount);
  const staff = await db.staffMember.findMany({
    where: { ...filters, status: showRemoved ? "INACTIVE" : "ACTIVE" },
    orderBy: { employeeCode: "asc" },
    skip: paging.skip,
    take: paging.take,
    include: { cashierAccount: { select: { active: true } } },
  });

  // Tabs keep the current search and filters.
  const tabHref = (removed: boolean) => {
    const sp = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v && k !== "status" && k !== "page" ? [[k, v]] : [])));
    if (removed) sp.set("status", "removed");
    const qs = sp.toString();
    return `/admin/staff${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(q || job || access);

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`Non-teaching staff: ${payroll._count} on the payroll, ${rupees(payroll._sum.monthlySalary ?? 0)} a month in salaries.`}
        action={
          <ButtonLink href="/admin/staff/new" icon={UserPlus}>
            Add staff
          </ButtonLink>
        }
      />

      <Card padded={false}>
        <div className="flex flex-col gap-4 border-b border-line px-4 pt-4 sm:px-6">
          <div className={tabBarClass}>
            <StatusTab href={tabHref(false)} active={!showRemoved} label="Active" count={activeCount} />
            <StatusTab href={tabHref(true)} active={showRemoved} label="Removed" count={removedCount} />
          </div>
          <div className="pb-4">
            <ListToolbar>
              <SearchBox placeholder="Name, ID, job, phone or email…" />
              <FilterSelect name="job" label="Any job" options={jobs.map((j) => ({ value: j.designation, label: j.designation }))} />
              <FilterSelect
                name="access"
                label="Any access"
                options={[
                  { value: "cashier", label: "Cashiers" },
                  { value: "none", label: "No login" },
                ]}
              />
              <ResetFilters keys={["q", "job", "access"]} />
            </ListToolbar>
          </div>
        </div>

        {staff.length === 0 ? (
          <EmptyState
            icon={filtered ? SearchX : UserCog}
            title={filtered ? "No staff match your filters" : showRemoved ? "No removed staff" : "No non-teaching staff yet"}
            description={
              filtered
                ? "Try a different search or reset the filters."
                : showRemoved
                  ? "Staff you remove appear here. Their past salaries stay on record."
                  : "Add office staff, guards, helpers, drivers and others you pay each month. Make your cashier a staff member to let them collect fees."
            }
            action={
              !filtered && !showRemoved ? (
                <ButtonLink href="/admin/staff/new" icon={UserPlus}>
                  Add staff
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Staff member</th>
                <th className={thClass}>Job</th>
                <th className={`${thClass} hidden md:table-cell`}>Contact</th>
                <th className={`${thClass} hidden sm:table-cell text-right`}>Salary</th>
                <th className={thClass}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {staff.map((s) => (
                <tr key={s.id} className={`${trClass} group`}>
                  <td className={tdClass}>
                    <PersonCell
                      name={s.name}
                      href={`/admin/staff/${s.id}`}
                      photoUrl={photoUrl(s.photoId)}
                      sub={
                        <>
                          <span className="font-mono">{s.employeeCode}</span>
                          {s.qualification && <> · {s.qualification}</>}
                        </>
                      }
                    />
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge>{s.designation}</Badge>
                      {s.cashierAccount && (
                        <Badge tone={s.cashierAccount.active ? "amber" : "slate"}>
                          <Wallet className="h-3 w-3" />
                          {s.cashierAccount.active ? "Cashier" : "Cashier (off)"}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className={`${tdClass} hidden md:table-cell`}>
                    {s.phone ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg-2">
                        <Phone className="h-3.5 w-3.5 text-subtle" />
                        {s.phone}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className={`${tdClass} hidden text-right tabular-nums sm:table-cell`}>
                    {s.monthlySalary != null ? <span className="font-medium text-fg">{rupees(s.monthlySalary)}</span> : <span className="text-xs text-warning">Not set</span>}
                  </td>
                  <td className={`${tdClass} w-12 text-right`}>
                    <Link
                      href={`/admin/staff/${s.id}`}
                      aria-label={`Open ${s.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition group-hover:bg-surface-3 group-hover:text-accent-text"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination paging={paging} noun="staff" />
      </Card>
    </>
  );
}
