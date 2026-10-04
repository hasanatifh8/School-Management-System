import { PageHeader } from "@/components/ui";
import { getFeesAccess } from "@/lib/fees";
import { CollectShortcut } from "./collect-shortcut";
import { FeesTabs } from "./fees-tabs";

export default async function FeesLayout({ children }: LayoutProps<"/admin/fees">) {
  const { canManage, session } = await getFeesAccess();
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Fees"
          subtitle={`Collections, dues and receipts · Session ${session.name}`}
          action={<CollectShortcut />}
        />
      </div>
      <FeesTabs canManage={canManage} />
      {children}
    </>
  );
}
