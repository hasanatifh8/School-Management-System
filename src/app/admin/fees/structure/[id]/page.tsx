import { notFound } from "next/navigation";
import { Breadcrumbs, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { loadFeeHeads, requireFeesManager } from "@/lib/fees";
import { saveFeeHead } from "../../actions";
import { FeeHeadForm } from "../fee-head-form";

export default async function EditFeeHeadPage({ params, searchParams }: PageProps<"/admin/fees/structure/[id]">) {
  const { id } = await params;
  const { class: returnClass } = await searchParams;
  const { school, session } = await requireFeesManager();
  const [classes, heads] = await Promise.all([
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    loadFeeHeads(session.id),
  ]);
  const head = heads.find((h) => h.id === id);
  if (!head) notFound();
  // The transport fee's amounts are the stop fares, shown read-only from Transport.
  const routes = head.transport
    ? await db.transportRoute.findMany({
        where: { schoolId: school.id },
        orderBy: { routeNumber: "asc" },
        select: { id: true, routeNumber: true, name: true, stops: true, stopTimes: true, stopFares: true },
      })
    : undefined;
  return (
    <>
      <Breadcrumbs items={[{ label: "Fee structure", href: "/admin/fees/structure" }, { label: head.name }]} />
      <Card
        title={`Edit “${head.name}”`}
        description={head.transport ? "Charged monthly to every student on a bus. Changes apply to everything not yet paid." : "New amounts apply to everything not yet paid."}
      >
        <FeeHeadForm action={saveFeeHead.bind(null, head.id)} classes={classes} head={head} routes={routes} startMonth={session.startDate.getUTCMonth() + 1} returnClass={typeof returnClass === "string" ? returnClass : undefined} />
      </Card>
    </>
  );
}
