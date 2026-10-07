import { TabCrumbs } from "@/components/tab-crumbs";
import { PageHeader } from "@/components/ui";
import { getFeesAccess } from "@/lib/fees";
import { CollectShortcut } from "./collect-shortcut";
import { FeesTabs } from "./fees-tabs";

export default async function FeesLayout({ children }: LayoutProps<"/admin/fees">) {
  const { canManage, session } = await getFeesAccess();
  return (
    <>
      <div className="print:hidden">
        <TabCrumbs crumbs={{ "/admin/fees/structure": [{ label: "Settings", href: "/admin/settings" }, { label: "Fee structure" }] }} />
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
