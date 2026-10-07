import { Breadcrumbs, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireFeesManager } from "@/lib/fees";
import { saveFeeHead } from "../../actions";
import { FeeHeadForm } from "../fee-head-form";

export default async function NewFeeHeadPage({ searchParams }: PageProps<"/admin/fees/structure/new">) {
  const { class: returnClass } = await searchParams;
  const { school, session } = await requireFeesManager();
  const classes = await db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <Breadcrumbs items={[{ label: "Fee structure", href: "/admin/fees/structure" }, { label: "Add a fee" }]} />
      <Card title="Add a fee" description={`For session ${session.name}.`}>
        <FeeHeadForm action={saveFeeHead.bind(null, null)} classes={classes} startMonth={session.startDate.getUTCMonth() + 1} returnClass={typeof returnClass === "string" ? returnClass : undefined} />
      </Card>
    </>
  );
}
