import { ArrowRight, Bus } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { sessionMonths } from "@/lib/fees-shared";
import { getCurrentSession } from "@/lib/sessions";
import { admissionTransport } from "../../actions";
import { AdmissionSteps } from "../../admission-steps";
import { AdmissionStudent, loadAdmission } from "../admission-student";
import { TransportPicker } from "./transport-picker";

/** Admission step 2: find the student's stop and choose the bus that serves it. */
export default async function AdmissionTransportPage({ params }: PageProps<"/admin/students/new/[id]/transport">) {
  const { id } = await params;
  const { school, student } = await loadAdmission(id);
  const routes = await db.transportRoute.findMany({
    where: { schoolId: school.id },
    orderBy: { routeNumber: "asc" },
    select: {
      id: true,
      routeNumber: true,
      name: true,
      vehicleNumber: true,
      vehicleType: true,
      driverName: true,
      driverPhone: true,
      stops: true,
      stopTimes: true,
      stopFares: true,
      _count: { select: { students: { where: { status: "ACTIVE" } } } },
    },
  });
  const next = `/admin/students/new/${student.id}/fees`;

  return (
    <>
      <PageHeader
        title="New admission"
        subtitle="Does the student use school transport? Type their stop to see the buses that go there."
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: "New admission" }]}
      />
      <AdmissionSteps current={2} />
      <Card>
        <AdmissionStudent student={student} />
        {routes.length === 0 ? (
          <EmptyState
            icon={Bus}
            title="No bus routes yet"
            description="Add routes and their stops under Transport, then assign the student from their profile."
            action={
              <ButtonLink href={next} icon={ArrowRight}>
                Skip to fees
              </ButtonLink>
            }
          />
        ) : (
          <TransportPicker
            action={admissionTransport.bind(null, student.id)}
            skipHref={next}
            routes={routes.map(({ _count, ...r }) => ({ ...r, riders: _count.students }))}
            current={student.transportRouteId ? { routeId: student.transportRouteId, stop: student.transportStop ?? "" } : null}
            months={sessionMonths((await getCurrentSession(school.id)).startDate.toISOString().slice(0, 10))}
          />
        )}
      </Card>
    </>
  );
}
