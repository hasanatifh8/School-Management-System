import { notFound } from "next/navigation";
import {
  CircleCheck,
  Download,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  UserX,
  Wrench,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SchoolLogo } from "@/components/school-logo";
import { Badge, Card, PageHeader, buttonVariants, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/document-types";
import { storageBySchool } from "@/lib/power-tools";
import { schoolLogoUrl } from "@/lib/school";
import {
  deleteSchool,
  loadDemoIntoSchool,
  openSchoolAdmin,
  purgeRemovedPeople,
  resetSchoolData,
  setSchoolStatus,
  updateSchool,
} from "../../../actions";
import { SchoolForm } from "../../school-form";
import { AdminsCard } from "./admins-card";

export default async function PowerSchoolPage({ params, searchParams }: PageProps<"/power/schools/[id]">) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  const [school, storage] = await Promise.all([
    db.school.findUnique({
      where: { id },
      include: {
        logo: { select: { updatedAt: true } },
        admins: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, active: true, lastLoginAt: true } },
        _count: { select: { students: true, teachers: true, classes: true, subjects: true, houses: true, documents: true } },
      },
    }),
    storageBySchool(),
  ]);
  if (!school) notFound();

  const [removedStudents, removedTeachers] = await Promise.all([
    db.student.count({ where: { schoolId: id, status: "INACTIVE" } }),
    db.teacher.count({ where: { schoolId: id, status: "INACTIVE" } }),
  ]);
  const active = school.status === "ACTIVE";
  const empty = !school._count.students && !school._count.teachers && !school._count.classes && !school._count.subjects;
  const counts: [string, number | string][] = [
    ["Students", school._count.students],
    ["Teachers", school._count.teachers],
    ["Classes", school._count.classes],
    ["Subjects", school._count.subjects],
    ["Houses", school._count.houses],
    ["Documents", school._count.documents],
    ["Files stored", formatBytes(storage.get(id) ?? 0)],
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <SchoolLogo name={school.name} url={schoolLogoUrl(school)} size="lg" />
            <span>
              {school.name}
              <span className="mt-1 flex flex-wrap gap-1.5 text-sm font-normal">
                <Badge>{school.code}</Badge>
                {active ? <Badge tone="green" dot>Active</Badge> : <Badge tone="red" dot>Suspended</Badge>}
              </span>
            </span>
          </span>
        }
        breadcrumbs={[{ label: "Schools", href: "/power" }, { label: school.name }]}
        action={
          active && (
            <form action={openSchoolAdmin.bind(null, id)}>
              <button className={buttonVariants.primary}>
                <ExternalLink className="h-4 w-4" />
                Open Admin Portal
              </button>
            </form>
          )
        }
      />

      {created && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <CircleCheck className="h-4 w-4" /> School created. Click “Open Admin Portal” to start adding classes, teachers and students.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="School profile" description="Name, code, logo and contact details." className="xl:col-span-2">
          <SchoolForm action={updateSchool.bind(null, id)} school={school} logoUrl={schoolLogoUrl(school)} submitLabel="Save changes" />
        </Card>

        <div className="space-y-6 self-start">
          <AdminsCard schoolId={id} schoolName={school.name} admins={school.admins} />

          <Card title="Status" icon={active ? PauseCircle : PlayCircle}>
            <p className="mb-3 text-sm text-slate-500">
              {active
                ? "Suspending hides the school from the Admin Portal. Its data is kept."
                : "This school is hidden from the Admin Portal. Activate it to use it again."}
            </p>
            <ActionForm action={setSchoolStatus.bind(null, id, active ? "SUSPENDED" : "ACTIVE")} compact className="flex flex-col items-start gap-2">
              <SubmitButton
                variant={active ? "secondary" : "primary"}
                confirm={active ? `Suspend ${school.name}?` : undefined}
                icon={active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
              >
                {active ? "Suspend school" : "Activate school"}
              </SubmitButton>
            </ActionForm>
          </Card>

          <Card title="Data tools" icon={Wrench}>
            <div className="space-y-5 text-sm">
              <div>
                <p className="font-medium text-slate-800">Backup</p>
                <p className="mb-2 text-slate-500">Everything in one Excel file: profile, students, teachers, classes, subjects, houses and sessions.</p>
                <a href={`/api/power/schools/${id}/backup`} className={`${buttonVariants.secondary} !py-2`} download>
                  <Download className="h-4 w-4" />
                  Download backup
                </a>
              </div>

              {empty && (
                <div className="border-t border-slate-100 pt-5">
                  <p className="font-medium text-slate-800">Demo data</p>
                  <p className="mb-2 text-slate-500">Classes 1–5, subjects, houses, 4 teachers and 20 students.</p>
                  <ActionForm action={loadDemoIntoSchool.bind(null, id)} compact className="flex flex-col items-start gap-2">
                    <SubmitButton variant="secondary" size="sm" icon={<Sparkles className="h-4 w-4" />}>
                      Load demo data
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}

              <div className="border-t border-slate-100 pt-5">
                <p className="font-medium text-slate-800">Purge removed records</p>
                <p className="mb-2 text-slate-500">
                  Permanently deletes removed students ({removedStudents}) and teachers ({removedTeachers}) with their photos
                  and documents.
                </p>
                <ActionForm action={purgeRemovedPeople.bind(null, id)} compact className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-slate-600">
                    removed at least
                    <input name="days" type="number" min={0} max={3650} defaultValue={30} className={`${inputClass} !w-20 !py-1.5`} />
                    days ago
                  </label>
                  <SubmitButton
                    variant="secondary"
                    size="sm"
                    confirm="Permanently delete these removed records? This cannot be undone."
                    icon={<UserX className="h-4 w-4" />}
                  >
                    Purge
                  </SubmitButton>
                </ActionForm>
              </div>
            </div>
          </Card>

          <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
            <h2 className="font-semibold text-rose-900">Danger zone</h2>
            <p className="mt-1 text-sm text-rose-800/80">
              These can&apos;t be undone. Download a backup first. Type <strong className="font-mono">{school.code}</strong> to
              confirm.
            </p>

            <ActionForm action={resetSchoolData.bind(null, id)} className="mt-5 space-y-2">
                  <p className="text-sm font-medium text-slate-800">Reset school data</p>
                  <p className="text-xs text-slate-500">Deletes all students, teachers, classes, subjects, houses, sessions and files. Keeps the school and its profile.</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      name="confirm"
                      aria-label={`Type ${school.code} to confirm`}
                      autoComplete="off"
                      placeholder={school.code}
                      className={`${inputClass} !w-auto flex-1 !py-2 font-mono uppercase`}
                    />
                    <SubmitButton variant="danger" size="sm" icon={<RotateCcw className="h-4 w-4" />}>
                      Reset data
                    </SubmitButton>
                  </div>
            </ActionForm>

            <ActionForm action={deleteSchool.bind(null, id)} className="mt-6 space-y-2 border-t border-rose-200 pt-5">
                  <p className="text-sm font-medium text-slate-800">Delete school</p>
                  <p className="text-xs text-slate-500">Removes the school and everything in it.</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      name="confirm"
                      aria-label={`Type ${school.code} to confirm`}
                      autoComplete="off"
                      placeholder={school.code}
                      className={`${inputClass} !w-auto flex-1 !py-2 font-mono uppercase`}
                    />
                    <SubmitButton variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />}>
                      Delete school
                    </SubmitButton>
                  </div>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
