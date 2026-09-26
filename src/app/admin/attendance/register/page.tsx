import { Download, School, TriangleAlert, UserRoundX, Users } from "lucide-react";
import { FilterSelect, ListToolbar } from "@/components/list-toolbar";
import { ClassSummaryTable, RegisterFilters, RegisterView, pickView, registerDownloadHref } from "@/components/attendance/register-view";
import { Card, PageHeader, StatCard, StatGrid, buttonVariants } from "@/components/ui";
import { attendanceWindow, loadClassSummaries, loadRegister, pickRange } from "@/lib/attendance";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

/**
 * School-wide attendance register. With no class chosen it compares every
 * class over the chosen period; choosing a class opens that class's register.
 * Filters: ?section=, ?classId= (all sections of a class), period (see
 * pickRange), ?q= and ?band= for students.
 */
export default async function AttendanceRegisterPage({ searchParams }: PageProps<"/admin/attendance/register">) {
  const query = await searchParams;
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const range = pickRange(query, win);
  const base = "/admin/attendance/register";

  const [sections, classes] = await Promise.all([
    db.section.findMany({
      where: { class: { schoolId: school.id } },
      orderBy: [{ class: { sortOrder: "asc" } }, { class: { name: "asc" } }, { name: "asc" }],
      include: { class: true },
    }),
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const section = sections.find((s) => s.id === query.section);
  const classId = typeof query.classId === "string" ? query.classId : "";

  // Class picker: any section, or narrow the class-wise view to one class.
  const picker = (
    <ListToolbar>
      <FilterSelect
        name="section"
        label="All classes"
        resets={["classId", "q", "band", "view"]}
        options={sections.map((s) => ({ value: s.id, label: sectionLabel(s) }))}
      />
      {!section && classes.length > 1 && (
        <FilterSelect name="classId" label="Every class" options={classes.map((c) => ({ value: c.id, label: `Only ${c.name}` }))} />
      )}
    </ListToolbar>
  );

  if (section) {
    const register = await loadRegister(school.id, section.id, range.from, range.to, win);
    return (
      <>
        <PageHeader
          title="Attendance register"
          breadcrumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Register", href: `${base}?${range.query}` }, { label: sectionLabel(section) }]}
          subtitle={`${sectionLabel(section)} · ${range.label}`}
          action={
            <a href={registerDownloadHref(section.id, range, query)} download className={buttonVariants.primary}>
              <Download className="h-4 w-4" />
              Download Excel
            </a>
          }
        />
        <RegisterView
          basePath={base}
          params={query}
          register={register}
          range={range}
          view={pickView(query, range)}
          min={win.min}
          max={win.max}
          dayHref={(d) => `/admin/attendance/${section.id}?date=${d}`}
          leading={picker}
        />
      </>
    );
  }

  const all = await loadClassSummaries(school.id, range.from, range.to);
  const shown = classId ? all.filter((c) => c.classId === classId) : all;
  const withData = shown.filter((c) => c.average != null);
  const average = withData.length ? Math.round((withData.reduce((n, c) => n + c.average! * c.students, 0) / withData.reduce((n, c) => n + c.students, 0)) * 10) / 10 : null;
  const keep = new URLSearchParams(range.query);
  if (query.view === "summary") keep.set("view", "summary");

  return (
    <>
      <PageHeader
        title="Attendance register"
        breadcrumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Register" }]}
        subtitle={`Every class · ${range.label}`}
        action={
          <a href={`${registerDownloadHref("all", range)}${classId ? `&classId=${classId}` : ""}`} download className={buttonVariants.primary}>
            <Download className="h-4 w-4" />
            Download Excel
          </a>
        }
      />
      <div className="space-y-6">
        <RegisterFilters basePath={base} params={query} range={range} min={win.min} max={win.max} leading={picker} />
        <StatGrid>
          <StatCard icon={School} tone="indigo" label="Classes" value={shown.length} detail={`${withData.length} with attendance marked`} />
          <StatCard icon={Users} tone="emerald" label="School average" value={average == null ? "—" : `${average}%`} detail="Weighted by class size" />
          <StatCard icon={TriangleAlert} tone="amber" label="Students below 75%" value={shown.reduce((n, c) => n + c.below75, 0)} detail="Open a class to see who" />
          <StatCard icon={UserRoundX} tone="rose" label="Absences" value={shown.reduce((n, c) => n + c.absences, 0)} detail={range.label} />
        </StatGrid>
        <Card title="Class-wise attendance" description="Pick a class to see its day-by-day register." padded={false}>
          <ClassSummaryTable classes={shown} registerHref={(id) => `${base}?section=${id}&${keep}`} />
        </Card>
      </div>
    </>
  );
}
