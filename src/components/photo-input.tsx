"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CircleAlert, ImagePlus, Loader2, Trash2, UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui";

// Passport photo: 35 × 45 mm → 7:9, stored at 350 × 450 px.
const OUT_W = 350;
const OUT_H = 450;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** Centre-crops an image to passport proportions and re-encodes it as JPEG. */
async function toPassportPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.max(OUT_W / bitmap.width, OUT_H / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;

  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
  ctx.fillRect(0, 0, OUT_W, OUT_H);
  ctx.imageSmoothingQuality = "high";
  // Horizontally centred; vertically biased towards the top where the face usually is.
  ctx.drawImage(bitmap, (OUT_W - w) / 2, (OUT_H - h) * 0.3, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Could not process the image.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/**
 * Passport photo picker for use inside a form. Submits the processed image as
 * the `photo` file field, and `removePhoto=on` when an existing photo is removed.
 */
export function PhotoInput({
  currentUrl,
  error,
}: {
  currentUrl?: string | null;
  error?: string;
}) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null); // the named input that gets submitted
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // A successful save resets the form; drop the local preview so the saved photo shows.
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
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setLocalError(null);
    if (!file.type.startsWith("image/")) return setLocalError("Please choose an image file.");
    if (file.size > MAX_INPUT_BYTES) return setLocalError("Image is too large (max 15 MB).");

    setBusy(true);
    try {
      const photo = await toPassportPhoto(file);
      const transfer = new DataTransfer();
      transfer.items.add(photo);
      fieldRef.current!.files = transfer.files;
      setPreview(URL.createObjectURL(photo));
      setRemoved(false);
    } catch {
      setLocalError("Could not read this image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  function onRemove() {
    if (fieldRef.current) fieldRef.current.value = "";
    if (preview) setPreview(null);
    else setRemoved(true);
  }

  const shown = preview ?? (removed ? null : currentUrl ?? null);
  const message = localError ?? error;

  return (
    <div className="flex items-start gap-5 sm:col-span-2">
      <div
        className={`relative flex aspect-[7/9] w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-slate-50 ${
          message ? "border-rose-300" : "border-slate-200"
        }`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob / API image
          <img src={shown} alt="Photo preview" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="h-12 w-12 text-slate-300" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </span>
        )}
      </div>

      <div className="min-w-0 pt-1">
        <p className="text-sm font-medium text-slate-700">Passport photo</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          JPG, PNG or WebP. It is cropped to passport size (35 × 45 mm) automatically.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label htmlFor={id} className={`${buttonVariants.secondary} cursor-pointer !px-3 !py-2`}>
            {shown ? <Camera className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
            {shown ? "Change photo" : "Upload photo"}
          </label>
          {shown && (
            <button type="button" onClick={onRemove} className={buttonVariants.dangerGhost}>
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
        {preview && <p className="mt-2 text-xs text-indigo-600">New photo selected. Save to apply.</p>}
        {removed && !preview && <p className="mt-2 text-xs text-amber-600">Photo will be removed when you save.</p>}
        {message && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-rose-600">
            <CircleAlert className="h-3.5 w-3.5" />
            {message}
          </p>
        )}
      </div>

      {/* Visible picker (unnamed) and the processed file that is actually submitted. */}
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={onPick} className="sr-only" />
      <input ref={fieldRef} type="file" name="photo" className="hidden" tabIndex={-1} aria-hidden />
      {removed && !preview && <input type="hidden" name="removePhoto" value="on" />}
    </div>
  );
}
