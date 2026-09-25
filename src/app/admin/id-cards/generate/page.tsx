import Link from "next/link";
import { IdCard } from "lucide-react";
import { GeneratedCards } from "@/components/id-card/generated-cards";
import { parseLayout } from "@/components/id-card/layouts";
import { IdCardSteps } from "@/components/id-card/steps";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MAX_CARDS_PER_BATCH, loadIdCards } from "@/lib/id-cards";
import { getCurrentSchool } from "@/lib/school";

/** Step 3: the chosen students' cards (?ids=a,b,c), to download or print. */
export default async function GenerateIdCardsPage({ searchParams }: PageProps<"/admin/id-cards/generate">) {
  const sp = await searchParams;
  const school = await getCurrentSchool();
  const ids = (typeof sp.ids === "string" ? sp.ids.split(",") : []).filter(Boolean).slice(0, MAX_CARDS_PER_BATCH);
  const data = await loadIdCards(school.id, { id: { in: ids } });
  const first = data.cards[0];
  const sectionId = data.sectionIds.length === 1 ? data.sectionIds[0] : null;
  const classHref = sectionId ? `/admin/id-cards?section=${sectionId}` : "/admin/id-cards";
  const title = data.cards.length === 1 ? `${first.name}'s ID card` : `${data.cards.length} ID cards`;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={data.cards.length ? title : "ID cards"}
          breadcrumbs={[{ label: "ID cards", href: "/admin/id-cards" }, ...(first ? [{ label: `${first.className} – ${first.sectionName}`, href: classHref }] : []), { label: "Generate" }]}
          subtitle={`Valid till ${data.validTill}`}
        />
        <IdCardSteps steps={[{ label: "Choose class", href: "/admin/id-cards" }, { label: "Pick students", href: classHref }, { label: "Download or print" }]} current={2} />
      </div>
      {data.cards.length ? (
        <GeneratedCards
          data={data}
          layout={parseLayout(sp.layout)}
          zipName={`id-cards-${first.className}-${first.sectionName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          profileHref={(id) => `/admin/students/${id}`}
        />
      ) : (
        <Card>
          <EmptyState
            icon={IdCard}
            title="No students chosen"
            action={
              <Link href="/admin/id-cards" className="text-sm font-medium text-indigo-600">
                Choose a class
              </Link>
            }
          />
        </Card>
      )}
    </>
  );
}
