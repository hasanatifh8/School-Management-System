"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, FileArchive, Loader2, Printer } from "lucide-react";
import { buttonVariants, inputClass, selectClass } from "@/components/ui";
import { CARD_RATIO, CUSTOM_WIDTH, ID_CARD_LAYOUTS, IMAGE_SIZES, type IdCardLayout, type ImageSizeKey } from "./layouts";

export type GeneratorItem = { id: string; name: string; fileBase: string; front: ReactNode };
type Format = "png" | "jpeg";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function canvasBlob(canvas: HTMLCanvasElement, format: Format) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image"))), `image/${format}`, 0.95),
  );
}

/** Renders one card's DOM to a canvas of exactly `width` px wide (height follows the card's shape). */
async function renderCard(node: HTMLElement, width: number) {
  const { toCanvas } = await import("html-to-image");
  const height = Math.round(width * CARD_RATIO);
  return toCanvas(node, {
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    backgroundColor: "#ffffff",
    // Square corners and no shadow: print shops cut the rounded corners themselves.
    style: { borderRadius: "0", boxShadow: "none", margin: "0" },
  });
}

/**
 * Step 3: the generated cards, with image downloads (single images or a ZIP)
 * and printing. Cards are rendered on the server and passed in as `front` /
 * `back`; the images are drawn from them in the browser.
 */
export function IdCardGenerator({
  items,
  back,
  printSheets,
  layout,
  zipName,
}: {
  items: GeneratorItem[];
  back: ReactNode;
  printSheets: ReactNode;
  layout: IdCardLayout;
  zipName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [size, setSize] = useState<ImageSizeKey>("print300");
  const [customWidth, setCustomWidth] = useState(1000);
  const [format, setFormat] = useState<Format>("png");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const width = size === "custom" ? Math.min(CUSTOM_WIDTH.max, Math.max(CUSTOM_WIDTH.min, Math.round(customWidth) || 0)) : IMAGE_SIZES[size].width;
  const height = Math.round(width * CARD_RATIO);
  const ext = format === "png" ? "png" : "jpg";
  const single = items.length === 1;

  const cardNode = (selector: string) => document.querySelector<HTMLElement>(`${selector} > div`)!;

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while making the image.");
    } finally {
      setBusy(null);
    }
  }

  const downloadFront = (item: GeneratorItem) =>
    run(`front-${item.id}`, async () => {
      saveBlob(await canvasBlob(await renderCard(cardNode(`[data-front="${item.id}"]`), width), format), `${item.fileBase}-front.${ext}`);
    });

  const downloadBack = () =>
    run("back", async () => {
      saveBlob(await canvasBlob(await renderCard(cardNode("[data-back]"), width), format), `${items[0]?.fileBase ?? "id-card"}-back.${ext}`);
    });

  /** Front and back side by side in one image. */
  const downloadBoth = (item: GeneratorItem) =>
    run("both", async () => {
      const front = await renderCard(cardNode(`[data-front="${item.id}"]`), width);
      const backCanvas = await renderCard(cardNode("[data-back]"), width);
      const gap = Math.round(width * 0.08);
      const canvas = document.createElement("canvas");
      canvas.width = width * 2 + gap;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(front, 0, 0);
      ctx.drawImage(backCanvas, width + gap, 0);
      saveBlob(await canvasBlob(canvas, format), `${item.fileBase}-front-and-back.${ext}`);
    });

  const downloadZip = () =>
    run("zip", async () => {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const [i, item] of items.entries()) {
        setBusy(`zip:${i + 1}`);
        const canvas = await renderCard(cardNode(`[data-front="${item.id}"]`), width);
        zip.file(`${item.fileBase}-front.${ext}`, await canvasBlob(canvas, format));
      }
      setBusy("zip:back");
      zip.file(`back.${ext}`, await canvasBlob(await renderCard(cardNode("[data-back]"), width), format)); // same for every student
      saveBlob(await zip.generateAsync({ type: "blob" }), `${zipName}.zip`);
    });

  const setLayout = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("layout", value);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const zipProgress = busy?.startsWith("zip:") ? busy.slice(4) : null;
  const scale = single ? 1.45 : 1;

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Download settings */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-[15px] font-semibold text-slate-900">Download as image</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Size</span>
              <select value={size} onChange={(e) => setSize(e.target.value as ImageSizeKey)} className={`${selectClass} !w-[22rem] max-w-full`}>
                {Object.entries(IMAGE_SIZES).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                    {s.width ? ` · ${s.width} × ${Math.round(s.width * CARD_RATIO)} px` : ""}
                  </option>
                ))}
              </select>
            </label>
            {size === "custom" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Width (px)</span>
                <input
                  type="number"
                  min={CUSTOM_WIDTH.min}
                  max={CUSTOM_WIDTH.max}
                  step={10}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className={`${inputClass} !w-32`}
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={`${selectClass} !w-32`}>
                <option value="png">PNG</option>
                <option value="jpeg">JPG</option>
              </select>
            </label>
            <p className="pb-2.5 text-xs text-slate-500">
              Each image: {width} × {height} px
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {single ? (
              <>
                <button type="button" disabled={!!busy} onClick={() => downloadFront(items[0])} className={buttonVariants.primary}>
                  {busy === `front-${items[0].id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Front
                </button>
                <button type="button" disabled={!!busy} onClick={downloadBack} className={buttonVariants.secondary}>
                  {busy === "back" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Back
                </button>
                <button type="button" disabled={!!busy} onClick={() => downloadBoth(items[0])} className={buttonVariants.secondary}>
                  {busy === "both" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Front + back in one image
                </button>
              </>
            ) : (
              <button type="button" disabled={!!busy} onClick={downloadZip} className={buttonVariants.primary}>
                {zipProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                {zipProgress
                  ? zipProgress === "back"
                    ? "Adding the back…"
                    : `Making ${zipProgress} of ${items.length}…`
                  : `Download all ${items.length} as ZIP`}
              </button>
            )}
          </div>
          {!single && <p className="mt-2 text-xs text-slate-500">The ZIP has each student&apos;s front and one back image (the back is the same for everyone).</p>}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>

        {/* Print settings */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Print layout (A4)</span>
            <select value={layout} onChange={(e) => setLayout(e.target.value)} className={`${selectClass} !w-80`}>
              {Object.entries(ID_CARD_LAYOUTS).map(([key, l]) => (
                <option key={key} value={key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => window.print()} className={buttonVariants.secondary}>
            <Printer className="h-4 w-4" />
            Print {items.length === 1 ? "card" : `${items.length} cards`}
          </button>
          <p className="basis-full text-xs text-slate-500">
            In the print window, turn on <strong>Background graphics</strong> and keep the scale at 100% so cards print at their real size.
          </p>
        </div>

        {/* Preview */}
        <div className="flex flex-wrap gap-5">
          {items.map((item) => (
            <div key={item.id} className="text-center">
              <div style={{ width: `calc(54mm * ${scale})`, height: `calc(85.6mm * ${scale})` }}>
                <div data-front={item.id} className="origin-top-left" style={{ transform: `scale(${scale})` }}>
                  {item.front}
                </div>
              </div>
              {!single && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => downloadFront(item)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                >
                  {busy === `front-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {item.name}
                </button>
              )}
            </div>
          ))}
          <div className="text-center">
            <div style={{ width: `calc(54mm * ${scale})`, height: `calc(85.6mm * ${scale})` }}>
              <div data-back className="origin-top-left" style={{ transform: `scale(${scale})` }}>
                {back}
              </div>
            </div>
            {!single && (
              <button
                type="button"
                disabled={!!busy}
                onClick={downloadBack}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
              >
                {busy === "back" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Back (same for all)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Only the A4 sheets are printed */}
      <div className="hidden print:block">{printSheets}</div>
    </>
  );
}
