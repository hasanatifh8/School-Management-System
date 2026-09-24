"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, School, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui";

const MAX_SIDE = 512;

/** Scales a logo to fit 512×512 (keeping its shape and transparency) as PNG. */
async function toLogo(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not process the image.");
  return new File([blob], "logo.png", { type: "image/png" });
}

/** Logo picker for a form: submits `logo` (processed PNG) and `removeLogo=on`. */
export function LogoInput({ currentUrl, error }: { currentUrl?: string | null; error?: string }) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const form = fieldRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setPreview(null);
      setRemoved(false);
      setLocalError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLocalError(null);
    if (!file.type.startsWith("image/")) return setLocalError("Please choose an image file.");
    setBusy(true);
    try {
      const logo = await toLogo(file);
      const transfer = new DataTransfer();
      transfer.items.add(logo);
      fieldRef.current!.files = transfer.files;
      setPreview(URL.createObjectURL(logo));
      setRemoved(false);
    } catch {
      setLocalError("Could not read this image. Try a PNG or JPG.");
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? (removed ? null : currentUrl ?? null);
  const message = localError ?? error;

  return (
    <div className="flex items-center gap-5 sm:col-span-2">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[conic-gradient(#f1f5f9_25%,white_0_50%,#f1f5f9_0_75%,white_0)] bg-[length:16px_16px]">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob / API image
          <img src={shown} alt="School logo" className="h-full w-full object-contain p-2" />
        ) : (
          <School className="h-10 w-10 text-slate-300" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">School logo</p>
        <p className="mt-0.5 text-xs text-slate-500">PNG with a transparent background works best. Resized to 512 px.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label htmlFor={id} className={`${buttonVariants.secondary} cursor-pointer !px-3 !py-2`}>
            <ImagePlus className="h-4 w-4" />
            {shown ? "Change logo" : "Upload logo"}
          </label>
          {shown && (
            <button
              type="button"
              className={buttonVariants.dangerGhost}
              onClick={() => {
                if (fieldRef.current) fieldRef.current.value = "";
                if (preview) setPreview(null);
                else setRemoved(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
        {preview && <p className="mt-2 text-xs text-indigo-600">New logo selected. Save to apply.</p>}
        {removed && !preview && <p className="mt-2 text-xs text-amber-600">Logo will be removed when you save.</p>}
        {message && <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>}
      </div>
      <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={onPick} className="sr-only" />
      <input ref={fieldRef} type="file" name="logo" className="hidden" tabIndex={-1} aria-hidden />
      {removed && !preview && <input type="hidden" name="removeLogo" value="on" />}
    </div>
  );
}
