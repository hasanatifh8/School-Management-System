import { HandCoins } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getFeesAccess } from "@/lib/fees";
import { FeesTabs } from "./fees-tabs";

export default async function FeesLayout({ children }: LayoutProps<"/admin/fees">) {
  const { canManage, session } = await getFeesAccess();
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Fees"
          subtitle={`Collections, dues and receipts · Session ${session.name}`}
          action={
            <ButtonLink href="/admin/fees/collect" icon={HandCoins}>
              Collect fee
            </ButtonLink>
          }
        />
      </div>
      <FeesTabs canManage={canManage} />
      {children}
    </>
  );
}
