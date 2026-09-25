import { PageHeader } from "@/components/ui";
import { getFeesAccess } from "@/lib/fees";
import { FeesTabs } from "./fees-tabs";

export default async function FeesLayout({ children }: LayoutProps<"/admin/fees">) {
  const { canManage, session } = await getFeesAccess();
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Fees" subtitle={`Session ${session.name}`} />
      </div>
      <FeesTabs canManage={canManage} />
      {children}
    </>
  );
}
