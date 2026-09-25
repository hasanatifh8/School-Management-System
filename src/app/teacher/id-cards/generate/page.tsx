import { notFound } from "next/navigation";
import { GeneratedCards } from "@/components/id-card/generated-cards";
import { parseLayout } from "@/components/id-card/layouts";
import { IdCardSteps } from "@/components/id-card/steps";
import { PageHeader } from "@/components/ui";
import { MAX_CARDS_PER_BATCH, loadIdCards } from "@/lib/id-cards";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

/** The chosen students' cards (?ids=), limited to the teacher's own class. */
export default async function TeacherGenerateIdCardsPage({ searchParams }: PageProps<"/teacher/id-cards/generate">) {
  const ctx = await requireTeacher();
  if (!ctx.classSection) notFound();
  const sp = await searchParams;
  const ids = (typeof sp.ids === "string" ? sp.ids.split(",") : []).filter(Boolean).slice(0, MAX_CARDS_PER_BATCH);
  const data = await loadIdCards(ctx.school.id, { id: { in: ids }, sectionId: ctx.classSection.id });
  if (!data.cards.length) notFound();
  const label = sectionLabel(ctx.classSection);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={data.cards.length === 1 ? `${data.cards[0].name}'s ID card` : `${data.cards.length} ID cards`}
          breadcrumbs={[{ label: "ID cards", href: "/teacher/id-cards" }, { label: "Generate" }]}
          subtitle={`${label} · valid till ${data.validTill}`}
        />
        <IdCardSteps steps={[{ label: "Pick students", href: "/teacher/id-cards" }, { label: "Download or print" }]} current={1} />
      </div>
      <GeneratedCards
        data={data}
        layout={parseLayout(sp.layout)}
        zipName={`id-cards-${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
        profileHref={(id) => `/teacher/students/${id}`}
      />
    </>
  );
}
