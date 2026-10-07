import Link from "next/link";
import { ArrowRight, Bus, MapPin, Phone, Plus, Users } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";

/** School bus and van routes, with how many students ride each. */
export default async function TransportPage() {
  const school = await getCurrentSchool();
  const routes = await db.transportRoute.findMany({
    where: { schoolId: school.id },
    orderBy: { routeNumber: "asc" },
    include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
  });
  const riders = routes.reduce((n, r) => n + r._count.students, 0);
  return (
    <>
      <PageHeader
        title="Transport"
        subtitle={routes.length ? `${routes.length} route${routes.length === 1 ? "" : "s"} · ${riders} students use school transport` : "Bus and van routes, their drivers, stops and fares. Each student's stop fare is added to their fees every month."}
        action={
          <ButtonLink href="/admin/transport/new" icon={Plus}>
            New route
          </ButtonLink>
        }
      />
      {routes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bus}
            title="No routes yet"
            description="Add each bus or van route with its driver and stops. Then put students on a route from their profile's Transport tab."
            action={<ButtonLink href="/admin/transport/new">Add the first route</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((r) => (
            <Link
              key={r.id}
              href={`/admin/transport/${r.id}`}
              className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-lg font-semibold text-fg">
                    <Bus className="h-5 w-5 text-accent-text" />
                    {r.routeNumber}
                  </p>
                  {r.name && <p className="truncate text-sm text-muted">{r.name}</p>}
                </div>
                <Badge tone="indigo">
                  <Users className="h-3 w-3" />
                  {r._count.students}
                </Badge>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted">Vehicle</dt>
                  <dd className="min-w-0 truncate font-mono text-fg">
                    {r.vehicleNumber}
                    {r.vehicleType && <span className="font-sans text-muted"> · {r.vehicleType}</span>}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted">Driver</dt>
                  <dd className="min-w-0 truncate text-fg">
                    {r.driverName ?? "—"}
                    {r.driverPhone && (
                      <span className="ml-1 inline-flex items-center gap-1 text-muted">
                        <Phone className="h-3 w-3" />
                        {r.driverPhone}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted">Stops</dt>
                  <dd className="min-w-0 truncate text-fg">
                    <MapPin className="mr-1 inline h-3.5 w-3.5 text-subtle" />
                    {r.stops.length ? `${r.stops.length}: ${r.stops[0]} → ${r.stops.at(-1)}` : "None yet"}
                  </dd>
                </div>
              </dl>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-text">
                Edit route <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
