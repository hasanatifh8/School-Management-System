import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { loadFeeHeads, requireFeesManager } from "@/lib/fees";
import { saveFeeHead } from "../../actions";
import { FeeHeadForm } from "../fee-head-form";

export default async function EditFeeHeadPage({ params }: PageProps<"/admin/fees/structure/[id]">) {
  const { id } = await params;
  const { school, session } = await requireFeesManager();
  const [classes, heads] = await Promise.all([
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    loadFeeHeads(session.id),
  ]);
  const head = heads.find((h) => h.id === id);
  if (!head) notFound();
  return (
    <Card title={`Edit “${head.name}”`} description="New amounts apply to everything not yet paid.">
      <FeeHeadForm action={saveFeeHead.bind(null, head.id)} classes={classes} head={head} />
    </Card>
  );
}
