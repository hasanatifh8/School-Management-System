import type { IdCardSchool, IdCardStudent } from "@/lib/id-cards";
import { ID_CARD_LAYOUTS, type IdCardLayout } from "./layouts";
import { IdCardBack, IdCardFront } from "./student-id-card";

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
}

/**
 * A4 print sheets of ID cards. "duplex" prints 9 fronts, then a page of the
 * matching backs mirrored left–right so they line up when printed double-sided
 * (flip on long edge). "pair" puts each card's back beside its front on
 * landscape pages, for single-sided printers.
 */
export function IdCardSheets({
  school,
  cards,
  validTill,
  layout,
}: {
  school: IdCardSchool;
  cards: IdCardStudent[];
  validTill: string;
  layout: IdCardLayout;
}) {
  const landscape = layout === "pair";
  const pages = chunk(cards, ID_CARD_LAYOUTS[layout].perPage);
  const front = (c: IdCardStudent) => <IdCardFront key={`f${c.id}`} school={school} student={c} validTill={validTill} />;
  const back = (key: string) => <IdCardBack key={key} school={school} />;
  const blank = (key: string) => <div key={key} className="h-[85.6mm] w-[54mm]" />;

  const sheets: { key: string; content: React.ReactNode[] }[] = [];
  pages.forEach((page, i) => {
    if (layout === "pair") {
      sheets.push({ key: `p${i}`, content: page.flatMap((c) => [front(c), back(`b${c.id}`)]) });
      return;
    }
    sheets.push({ key: `f${i}`, content: page.map(front) });
    if (layout === "duplex") {
      const padded = [...page, ...Array(Math.ceil(page.length / 3) * 3 - page.length).fill(null)];
      const mirrored = chunk(padded, 3).flatMap((row) => row.reverse());
      sheets.push({
        key: `b${i}`,
        content: mirrored.map((c, j) => (c ? back(`b${c.id}`) : blank(`x${j}`))),
      });
    }
  });

  return (
    <>
      <style>{`
        @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 10mm; }
        @media print { html, body { background: #fff !important; } }
      `}</style>
      <div>
        {sheets.map((s) => (
          <section key={s.key} className="break-after-page last:break-after-auto">
            <div
              className={landscape ? "w-[277mm]" : "w-[190mm]"}
            >
              <div className={`mx-auto grid w-fit gap-[4mm] ${landscape ? "grid-cols-4" : "grid-cols-3"}`}>{s.content}</div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
