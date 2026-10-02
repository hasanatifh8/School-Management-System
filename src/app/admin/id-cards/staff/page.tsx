import Link from "next/link";
import { IdCard } from "lucide-react";
import { GeneratedStaffCards } from "@/components/id-card/generated-cards";
import { parseLayout } from "@/components/id-card/layouts";
import { IdCardSteps } from "@/components/id-card/steps";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MAX_CARDS_PER_BATCH, loadStaffIdCards } from "@/lib/id-cards";
import { getCurrentSchool } from "@/lib/school";

const STEPS = [{ label: "Pick teachers & staff", href: "/admin/id-cards?tab=staff" }, { label: "Download or print" }];

/** Staff cards for ?ids=t:<teacherId>,s:<staffId>…, to download or print. */
export default async function GenerateStaffIdCardsPage({ searchParams }: PageProps<"/admin/id-cards/staff">) {
  const sp = await searchParams;
  const school = await getCurrentSchool();
  const keys = (typeof sp.ids === "string" ? sp.ids.split(",") : []).filter((k) => /^[ts]:/.test(k)).slice(0, MAX_CARDS_PER_BATCH);
  const data = await loadStaffIdCards(school.id, keys);
  const title = data.cards.length === 1 ? `${data.cards[0].name}'s ID card` : `${data.cards.length} staff ID cards`;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={data.cards.length ? title : "Staff ID cards"}
          breadcrumbs={[{ label: "ID cards", href: "/admin/id-cards?tab=staff" }, { label: "Generate" }]}
          subtitle={`Valid till ${data.validTill}`}
        />
        <IdCardSteps steps={STEPS} current={1} />
      </div>
      {data.cards.length ? (
        <GeneratedStaffCards
          data={data}
          layout={parseLayout(sp.layout)}
          zipName="staff-id-cards"
          profileHref={(c) => (c.teaching ? `/admin/teachers/${c.id}` : `/admin/staff/${c.id}`)}
        />
      ) : (
        <Card>
          <EmptyState
            icon={IdCard}
            title="No one chosen"
            action={
              <Link href="/admin/id-cards?tab=staff" className="text-sm font-medium text-accent-text">
                Choose teachers & staff
              </Link>
            }
          />
        </Card>
      )}
    </>
  );
}
