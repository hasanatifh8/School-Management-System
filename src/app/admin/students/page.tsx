import Link from "next/link";
import { RemovedCleanupBar } from "@/components/delete-permanently";
import { deletePermanently } from "../permanent-delete-actions";
import { Bus, ChevronRight, Download, FileSpreadsheet, GraduationCap, IdCard, SearchX, Sparkles, UserMinus, UserPlus, UserRound, UserRoundX, Users, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, getHouses, sectionLabel } from "@/lib/queries";
import { HouseBadge } from "@/components/house";
import { ExportDialog } from "@/components/export-dialog";
import { Pagination } from "@/components/pagination";
import { paginate } from "@/lib/pagination";
import { FilterSelect, ListToolbar, MoreFilters, ResetFilters, SearchBox } from "@/components/list-toolbar";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { parseStudentFilters, studentOrder, studentWhere, type StudentFilters } from "@/lib/list-filters";
import { getCurrentSession } from "@/lib/sessions";
import { CATEGORY_LABELS } from "@/lib/student-options";
import {
  Badge,
  ButtonLink,
  Card,
  Dash,
  EmptyState,
  IconTile,
  MenuLink,
  MoreMenu,
  PageHeader,
  PersonCell,
  cx,
  StatusTab,
  Table,
  tabBarClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { sectionTitle } from "@/lib/names";

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const school = await getCurrentSchool();
  const params = await searchParams;
  const f = parseStudentFilters(params);
  const session = await getCurrentSession(school.id);
  const filters = studentWhere(school.id, f, session.startDate);
  const showRemoved = f.removed;
  // Widget counts follow the class, house, search… filters, but not the widgets' own choices (gender, shortcut).
  const widgetBase = studentWhere(school.id, { ...f, gender: undefined, show: undefined } as StudentFilters, session.startDate);
  const activeBase = { ...widgetBase, status: "ACTIVE" as const };

  const [activeCount, removedCount, allRemoved, classes, houses, w] = await Promise.all([
    db.student.count({ where: { ...filters, status: "ACTIVE" } }),
    db.student.count({ where: { ...filters, status: "INACTIVE" } }),
    db.student.count({ where: { schoolId: school.id, status: "INACTIVE" } }),
    getClassesWithSections(school.id),
    getHouses(school.id),
    Promise.all([
      db.student.count({ where: activeBase }),
      db.student.count({ where: { ...activeBase, gender: "MALE" } }),
      db.student.count({ where: { ...activeBase, gender: "FEMALE" } }),
      db.student.count({ where: { ...activeBase, admissionDate: { gte: session.startDate } } }),
      db.student.count({ where: { ...activeBase, sectionId: null } }),
      db.student.count({ where: { ...activeBase, transportRouteId: { not: null } } }),
      db.student.count({ where: { ...widgetBase, status: "INACTIVE" } }),
    ]).then(([active, boys, girls, admitted, unplaced, transport, removed]) => ({ active, boys, girls, admitted, unplaced, transport, removed })),
  ]);
  const paging = paginate(params, showRemoved ? removedCount : activeCount);
  const students = await db.student.findMany({
    where: { ...filters, status: showRemoved ? "INACTIVE" : "ACTIVE" },
    orderBy: [...studentOrder(f), { id: "asc" }],
    skip: paging.skip,
    take: paging.take,
    include: { section: { include: { class: true } }, house: true, _count: { select: { subjects: true } } },
  });

  // Tabs keep the current search and filters.
  const tabHref = (removed: boolean) => {
    const sp = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v && k !== "status" && k !== "page" ? [[k, v]] : [])),
    );
    if (removed) sp.set("status", "removed");
    const qs = sp.toString();
    return `/admin/students${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(f.q || f.classId || f.sectionId || f.houseId || f.gender || f.category || f.bloodGroup || f.show);

  // A widget's link: the current filters, with its own choice set (or cleared when it's already on).
  const widgetHref = (set: { gender?: string; show?: string; status?: string }) => {
    const sp = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v && !["page", "status", "gender", "show"].includes(k) ? [[k, v]] : [])),
    );
    for (const [k, v] of Object.entries(set)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return `/admin/students${qs ? `?${qs}` : ""}`;
  };
  const pct = (n: number) => (w.active ? `${Math.round((n / w.active) * 100)}% of active` : "—");
  const widgets: { label: string; value: number; detail: string; icon: LucideIcon; tone: Parameters<typeof IconTile>[0]["tone"]; on: boolean; href: string }[] = [
    { label: "Active", value: w.active, detail: "On the rolls now", icon: Users, tone: "indigo", on: !showRemoved && !f.gender && !f.show, href: widgetHref({}) },
    { label: "Boys", value: w.boys, detail: pct(w.boys), icon: UserRound, tone: "sky", on: !showRemoved && f.gender === "MALE" && !f.show, href: widgetHref(f.gender === "MALE" && !f.show && !showRemoved ? {} : { gender: "MALE" }) },
    { label: "Girls", value: w.girls, detail: pct(w.girls), icon: UserRound, tone: "rose", on: !showRemoved && f.gender === "FEMALE" && !f.show, href: widgetHref(f.gender === "FEMALE" && !f.show && !showRemoved ? {} : { gender: "FEMALE" }) },
    { label: "New this session", value: w.admitted, detail: `Admitted in ${session.name}`, icon: Sparkles, tone: "emerald", on: !showRemoved && f.show === "new", href: widgetHref(f.show === "new" && !showRemoved ? {} : { show: "new" }) },
    { label: "Not in a class", value: w.unplaced, detail: w.unplaced ? "Assign a class and section" : "Everyone is placed", icon: UserRoundX, tone: w.unplaced ? "amber" : "slate", on: !showRemoved && f.show === "unplaced", href: widgetHref(f.show === "unplaced" && !showRemoved ? {} : { show: "unplaced" }) },
    { label: "School transport", value: w.transport, detail: pct(w.transport), icon: Bus, tone: "teal", on: !showRemoved && f.show === "transport", href: widgetHref(f.show === "transport" && !showRemoved ? {} : { show: "transport" }) },
    { label: "Removed", value: w.removed, detail: "Left or removed; can be restored", icon: UserMinus, tone: "slate", on: showRemoved && !f.gender && !f.show, href: widgetHref(showRemoved && !f.gender && !f.show ? {} : { status: "removed" }) },
  ];
  const sections = classes.find((c) => c.id === f.classId)?.sections ?? [];

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Admissions, class placement and parent contacts"
        action={
          <>
            <ExportDialog kind="students" count={paging.total} noun="students" />
            <MoreMenu>
              <MenuLink href="/admin/students/import" icon={<FileSpreadsheet />}>
                Bulk upload from Excel
              </MenuLink>
              <MenuLink href="/api/templates/students" icon={<Download />} download>
                Download Excel template
              </MenuLink>
              <MenuLink href="/admin/id-cards" icon={<IdCard />}>
                Generate ID cards
              </MenuLink>
            </MoreMenu>
            <ButtonLink href="/admin/students/new" icon={UserPlus}>
              New admission
            </ButtonLink>
          </>
        }
      />

      {/* Key numbers; each one filters the list below. */}
      <nav aria-label="Student groups" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {widgets.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            scroll={false}
            aria-current={k.on ? "true" : undefined}
            className={cx(
              "group rounded-2xl border bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift",
              k.on ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong",
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-muted">{k.label}</span>
              <IconTile icon={k.icon} tone={k.tone} size="sm" />
            </span>
            <span className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight text-fg">{k.value.toLocaleString("en-IN")}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{k.detail}</span>
          </Link>
        ))}
      </nav>

      <Card padded={false}>
        <div className="flex flex-col gap-4 border-b border-line px-4 pt-4 sm:px-6">
          <div className={tabBarClass}>
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
                  options={sections.map((sec) => ({ value: sec.id, label: sectionTitle(sec.name) }))}
                />
              )}
              <MoreFilters keys={["houseId", "gender", "category", "bloodGroup"]}>
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
              </MoreFilters>
              <ResetFilters keys={["q", "classId", "sectionId", "houseId", "gender", "category", "bloodGroup", "show"]} />
            </ListToolbar>
          </div>
        </div>
        {showRemoved && <RemovedCleanupBar kind="student" count={allRemoved} action={deletePermanently.bind(null, "student", null)} schoolCode={school.code} />}

        {students.length === 0 ? (
          <EmptyState
            title={filtered ? "No students match your filters" : showRemoved ? "No removed students" : "No students yet"}
            icon={filtered ? SearchX : GraduationCap}
            description={
              filtered
                ? "Try a different name, ID or class."
                : showRemoved
                  ? "Students you remove will appear here and can be restored."
                  : "Add your first student to get started."
            }
            action={
              !filtered && !showRemoved ? (
                <>
                  <ButtonLink href="/admin/students/new" icon={UserPlus}>
                    New admission
                  </ButtonLink>
                  <ButtonLink href="/admin/students/import" icon={FileSpreadsheet} variant="secondary">
                    Bulk upload
                  </ButtonLink>
                </>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Student</th>
                <th className={thClass}>Class</th>
                <th className={`${thClass} hidden md:table-cell`}>House</th>
                <th className={`${thClass} hidden lg:table-cell`}>Parents</th>
                <th className={`${thClass} hidden xl:table-cell`}>Subjects</th>
                <th className={thClass}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {students.map((s) => (
                <tr key={s.id} className={`${trClass} group`}>
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
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone="indigo">{sectionLabel(s.section)}</Badge>
                        {s.rollNumber != null && <span className="text-xs tabular-nums text-muted">Roll {s.rollNumber}</span>}
                      </div>
                    ) : (
                      <Badge tone="amber" dot>
                        Not assigned
                      </Badge>
                    )}
                  </td>
                  <td className={`${tdClass} hidden md:table-cell`}>{s.house ? <HouseBadge house={s.house} /> : <Dash />}</td>
                  <td className={`${tdClass} hidden lg:table-cell`}>
                    <div className="space-y-0.5 text-xs">
                      <ParentLine label="Father" name={s.fatherName} />
                      <ParentLine label="Mother" name={s.motherName} />
                      {!s.fatherName && !s.motherName && (
                        <span className="text-subtle">Not added</span>
                      )}
                    </div>
                  </td>
                  <td className={`${tdClass} hidden xl:table-cell`}>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface-3 px-1.5 text-xs font-semibold text-fg-2 tabular-nums">
                      {s._count.subjects}
                    </span>
                  </td>
                  <td className={`${tdClass} w-12 text-right`}>
                    <Link
                      href={`/admin/students/${s.id}`}
                      aria-label={`Open ${fullName(s)}`}
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
        <Pagination paging={paging} noun="students" />
      </Card>
    </>
  );
}

function ParentLine({ label, name }: { label: string; name: string | null }) {
  if (!name) return null;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="w-12 text-subtle">{label}</span>
      <span className="font-medium text-fg-2">{name}</span>
    </div>
  );
}
