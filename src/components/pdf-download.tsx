"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ButtonVariant } from "@/components/ui";
import { buttonClass } from "@/components/ui/button";

// A4 in PDF points.
const A4 = { w: 595.28, h: 841.89 };

/** Waits for every image under `root` (logos, photos) so they appear in the capture. */
async function imagesLoaded(root: HTMLElement) {
  await Promise.all(
    [...root.querySelectorAll("img")].map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((done) => ((img.onload = () => done()), (img.onerror = () => done()))),
    ),
  );
}

/**
 * Renders every `[data-pdf-page]` element inside `[data-pdf-root="<root>"]` to
 * one A4 page each (scaled to fit) and saves the PDF.
 */
export async function downloadPdf(root: string, fileName: string) {
  const container = document.querySelector<HTMLElement>(`[data-pdf-root="${root}"]`);
  const pages = container ? [...container.querySelectorAll<HTMLElement>("[data-pdf-page]")] : [];
  if (!pages.length) throw new Error("Nothing to download");
  const [{ toPng }, { PDFDocument }] = await Promise.all([import("html-to-image"), import("pdf-lib")]);
  await imagesLoaded(container!);
  const pdf = await PDFDocument.create();
  for (const node of pages) {
    const png = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", style: { boxShadow: "none", margin: "0" } });
    const image = await pdf.embedPng(png);
    const scale = Math.min(A4.w / image.width, A4.h / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    pdf.addPage([A4.w, A4.h]).drawImage(image, { x: (A4.w - w) / 2, y: A4.h - h, width: w, height: h });
  }
  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A button that saves the pages under `[data-pdf-root={root}]` as a PDF. */
export function PdfDownloadButton({
  root,
  fileName,
  label = "Download PDF",
  variant = "secondary",
}: {
  root: string;
  fileName: string;
  label?: string;
  variant?: ButtonVariant;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await downloadPdf(root, fileName);
          } catch {
            setError("Couldn't create the PDF. Try printing instead.");
          } finally {
            setBusy(false);
          }
        }}
        className={buttonClass({ variant })}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Preparing…" : label}
      </button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}

/**
 * Runs print or PDF download once when the page opens with ?do=print / ?do=pdf
 * (from a list's row buttons), after images have loaded.
 */
export function AutoRun({ action, root, fileName }: { action: string | undefined; root: string; fileName: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || (action !== "print" && action !== "pdf")) return;
    done.current = true;
    const container = document.querySelector<HTMLElement>(`[data-pdf-root="${root}"]`);
    (container ? imagesLoaded(container) : Promise.resolve()).then(() => {
      if (action === "print") window.print();
      else downloadPdf(root, fileName).catch(() => {});
    });
  }, [action, root, fileName]);
  return null;
}

