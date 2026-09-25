import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { loadIdCards } from "@/lib/id-cards";
import { IdCardGenerator } from "./id-card-generator";
import { IdCardSheets } from "./id-card-sheets";
import type { IdCardLayout } from "./layouts";
import { IdCardBack, IdCardFront } from "./student-id-card";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Step 3: warnings about missing details, then the generator (images and printing). */
export function GeneratedCards({
  data,
  layout,
  zipName,
  profileHref,
}: {
  data: Awaited<ReturnType<typeof loadIdCards>>;
  layout: IdCardLayout;
  zipName: string;
  profileHref: (id: string) => string;
}) {
  const { cards, school, validTill } = data;
  const incomplete = cards.filter((c) => c.missing.length);
  const schoolGaps = [!school.logoUrl && "logo", !school.address && "address", !school.phone && "phone number"].filter(Boolean);
  return (
    <div className="space-y-6">
      {(incomplete.length > 0 || schoolGaps.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-sm text-amber-900 print:hidden">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            Some details are missing. Those spaces are left blank on the card.
          </p>
          {schoolGaps.length > 0 && (
            <p className="mt-1.5">School {schoolGaps.join(", ")} not set. Power Admin can add it in the school&apos;s details.</p>
          )}
          {incomplete.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {incomplete.map((c) => (
                <li key={c.id}>
                  <Link href={profileHref(c.id)} className="font-medium underline">
                    {c.name}
                  </Link>{" "}
                  <span className="text-amber-800/80">no {c.missing.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <IdCardGenerator
        items={cards.map((c) => ({
          id: c.id,
          name: c.name,
          fileBase: slug(`${c.roll ? c.roll.padStart(2, "0") : ""} ${c.name} ${c.admissionNo}`),
          front: <IdCardFront school={school} student={c} validTill={validTill} />,
        }))}
        back={<IdCardBack school={school} />}
        printSheets={<IdCardSheets school={school} cards={cards} validTill={validTill} layout={layout} />}
        layout={layout}
        zipName={zipName}
      />
    </div>
  );
}

