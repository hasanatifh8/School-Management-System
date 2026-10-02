import { Card, PageHeader } from "@/components/ui";
import { saveRoute } from "../actions";
import { RouteForm } from "../route-form";

export default function NewRoutePage() {
  return (
    <>
      <PageHeader title="New route" breadcrumbs={[{ label: "Transport", href: "/admin/transport" }, { label: "New route" }]} />
      <Card>
        <RouteForm action={saveRoute.bind(null, null)} submitLabel="Save route" />
      </Card>
    </>
  );
}
