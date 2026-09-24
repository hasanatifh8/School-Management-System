import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Database,
  ExternalLink,
  GraduationCap,
  HardDrive,
  History,
  Plus,
  Presentation,
  School,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, buttonVariants } from "@/components/ui";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/document-types";
import { storageBySchool, systemInfo } from "@/lib/power-tools";
import { CURRENT_SCHOOL_COOKIE, schoolLogoUrl } from "@/lib/school";
import { SchoolLogo } from "@/components/school-logo";
import { cleanOrphanFiles, openSchoolAdmin } from "../actions";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function PowerDashboard({ searchParams }: PageProps<"/power">) {
  const sp = await searchParams;
  const current = (await cookies()).get(CURRENT_SCHOOL_COOKIE)?.value;
  const [schools, storage, system, activity] = await Promise.all([
    db.school.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        logo: { select: { updatedAt: true } },
        _count: {
          select: {
            students: { where: { status: "ACTIVE" } },
            teachers: { where: { status: "ACTIVE" } },
            classes: true,
          },
        },
      },
    }),
    storageBySchool(),
    systemInfo(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const activeIds = schools.filter((s) => s.status === "ACTIVE").map((s) => s.id);
  const currentId = current && activeIds.includes(current) ? current : activeIds[0];

  return (
    <>
      <PageHeader
        title="Schools"
        subtitle={`${schools.length} school(s) on this system`}
        action={
          <ButtonLink href="/power/schools/new" icon={Plus}>
            Add school
          </ButtonLink>
        }
      />

      {sp.setup === "1" && schools.length === 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
          <p>
            <strong>Welcome!</strong> There are no schools yet. Add your first school to start using the Admin Portal.
          </p>
        </div>
      )}
      {sp.deleted === "1" && (
        <p role="status" className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          The school and all its data were deleted.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {schools.length === 0 ? (
            <Card>
              <EmptyState
                icon={School}
                title="No schools yet"
                description="Add a school to begin. You can load demo data into it straight away."
                action={
                  <ButtonLink href="/power/schools/new" icon={Plus}>
                    Add school
                  </ButtonLink>
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {schools.map((s) => {
                const active = s.status === "ACTIVE";
                return (
                  <li
                    key={s.id}
                    className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${active ? "border-slate-200/80" : "border-dashed border-slate-300 opacity-80"}`}
                  >
                    <div className="flex items-start gap-4">
                      <SchoolLogo name={s.name} url={schoolLogoUrl(s)} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/power/schools/${s.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                          {s.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge>{s.code}</Badge>
                          {s.board && <Badge tone="sky">{s.board}</Badge>}
                          {active ? (
                            s.id === currentId && <Badge tone="indigo" dot>Open in Admin Portal</Badge>
                          ) : (
                            <Badge tone="red" dot>Suspended</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-slate-500">
                      <Stat icon={GraduationCap} value={s._count.students} label="students" />
                      <Stat icon={Presentation} value={s._count.teachers} label="teachers" />
                      <Stat icon={School} value={s._count.classes} label="classes" />
                      <Stat icon={HardDrive} value={formatBytes(storage.get(s.id) ?? 0)} label="files" />
                    </dl>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                      <Link href={`/power/schools/${s.id}`} className={`${buttonVariants.ghost} !px-2`}>
                        Manage <ArrowRight className="h-4 w-4" />
                      </Link>
                      {active && (
                        <form action={openSchoolAdmin.bind(null, s.id)}>
                          <button className={`${buttonVariants.secondary} !py-2`}>
                            <ExternalLink className="h-4 w-4" />
                            Open Admin Portal
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-6 self-start">
          <Card title="System" icon={Database}>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Database size</dt>
                <dd className="font-medium tabular-nums text-slate-900">{formatBytes(system.databaseBytes)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Migrations applied</dt>
                <dd className="font-medium tabular-nums text-slate-900">{system.migrations}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Latest migration</dt>
                <dd className="truncate font-mono text-xs text-slate-700" title={system.latestMigration}>
                  {system.latestMigration}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Unused stored files</dt>
                <dd className="font-medium tabular-nums text-slate-900">{system.orphanFiles}</dd>
              </div>
            </dl>
            <ActionForm action={cleanOrphanFiles} compact className="mt-4 flex flex-col items-start gap-2">
              <SubmitButton variant="secondary" size="sm" confirm="Delete stored files that no student, teacher or document uses?">
                Clean unused files
              </SubmitButton>
            </ActionForm>
          </Card>

          <Card
            title="Recent activity"
            icon={History}
            padded={false}
            action={
              <Link href="/power/activity" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                View all
              </Link>
            }
          >
            {activity.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((a) => (
                  <li key={a.id} className="px-6 py-3 text-sm">
                    <p className="font-medium text-slate-800">
                      {a.action}
                      {a.schoolName && <span className="font-normal text-slate-500"> · {a.schoolName}</span>}
                    </p>
                    <p className="text-xs text-slate-400">{when.format(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number | string; label: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1 py-2">
      <Icon className="mx-auto h-4 w-4 text-slate-400" />
      <dd className="mt-1 font-semibold tabular-nums text-slate-900">{value}</dd>
      <dt>{label}</dt>
    </div>
  );
}
