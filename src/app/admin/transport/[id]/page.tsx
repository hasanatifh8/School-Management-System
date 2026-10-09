import { notFound } from "next/navigation";
import { MapPin, Printer, Trash2, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Card, EmptyState, PageHeader, PersonCell } from "@/components/ui";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { rupees } from "@/lib/fees-shared";
import { getCurrentSchool } from "@/lib/school";
import { formatTime } from "@/lib/timetable-shared";
import { deleteRoute, saveRoute } from "../actions";
import { RouteForm } from "../route-form";

/** Edit a route, and see its students stop by stop. */
export default async function RoutePage({ params }: PageProps<"/admin/transport/[id]">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const route = await db.transportRoute.findFirst({
    where: { id, schoolId: school.id },
    include: {
      students: {
        where: { status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, middleName: true, lastName: true, photoId: true, transportStop: true, section: { include: { class: true } } },
      },
    },
  });
  if (!route) notFound();
  const stops = [...route.stops, null];
  const fare = (stop: string | null) => (stop ? route.stopFares[route.stops.indexOf(stop)] : 0);
  const time = (stop: string | null) => (stop ? route.stopTimes[route.stops.indexOf(stop)] : "");
  const at = (stop: string | null) => route.students.filter((s) => (stop ? s.transportStop === stop : !s.transportStop || !route.stops.includes(s.transportStop)));

  return (
    <>
      <PageHeader
        title={`Route ${route.routeNumber}`}
        subtitle={route.name ?? undefined}
        breadcrumbs={[{ label: "Transport", href: "/admin/transport" }, { label: route.routeNumber }]}
        action={
          <ButtonLink href={`/admin/transport/${route.id}/print`} variant="secondary" icon={Printer}>
            Print route
          </ButtonLink>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card key={route.updatedAt.toISOString()}>
            <RouteForm action={saveRoute.bind(null, route.id)} values={route} submitLabel="Save changes" />
          </Card>
          <Card title="Delete route" description="Its students are taken off school transport.">
            <ActionForm action={deleteRoute.bind(null, route.id)} compact className="flex flex-row-reverse items-center justify-end gap-3">
              <SubmitButton variant="danger" confirm={`Delete route ${route.routeNumber}?`} icon={<Trash2 className="h-4 w-4" />}>
                Delete
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
        <Card title="Students" icon={Users} description={`${route.students.length} on this route`} padded={false} className="self-start">
          {route.students.length === 0 ? (
            <EmptyState compact icon={Users} title="No students yet" description="Assign students from their profile's Transport tab." />
          ) : (
            <div className="divide-y divide-line">
              {stops.map((stop) => {
                const list = at(stop);
                if (!list.length) return null;
                return (
                  <div key={stop ?? "none"} className="px-6 py-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      {stop ?? "No stop chosen"}
                      {time(stop) ? ` (${formatTime(time(stop))})` : ""} · {list.length}
                      {fare(stop) ? <span className="ml-auto font-medium normal-case tracking-normal tabular-nums">{rupees(fare(stop))}/month</span> : null}
                    </p>
                    <ul className="space-y-2">
                      {list.map((s) => (
                        <li key={s.id}>
                          <PersonCell
                            name={fullName(s)}
                            photoUrl={photoUrl(s.photoId)}
                            href={`/admin/students/${s.id}?tab=transport`}
                            size="sm"
                            sub={s.section ? sectionLabel(s.section) : "No class"}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
