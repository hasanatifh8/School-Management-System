import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Upper bound after client-side resizing (a 350×450 JPEG is ~30–60 KB). */
const MAX_PHOTO_BYTES = 1024 * 1024;

export type PhotoUpload = { data: Uint8Array<ArrayBuffer>; mimeType: string };

/** Detects the image type from its first bytes rather than trusting the browser. */
function sniffImageType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    String.fromCharCode(...b.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Reads the optional `photo` file field.
 * Returns null when no file was chosen, or an error message when it is invalid.
 */
export async function readPhotoUpload(
  formData: FormData,
  field = "photo",
): Promise<{ photo: PhotoUpload | null } | { error: string }> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { photo: null };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo must be smaller than 1 MB." };

  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageType(data);
  if (!mimeType) return { error: "Photo must be a JPG, PNG or WebP image." };
  return { photo: { data, mimeType } };
}

/** Creates a photo row and returns its id. */
export async function createPhoto(tx: Prisma.TransactionClient, schoolId: string, photo: PhotoUpload) {
  const created = await tx.photo.create({ data: { schoolId, ...photo }, select: { id: true } });
  return created.id;
}

export function photoUrl(photoId: string | null | undefined) {
  return photoId ? `/api/photos/${photoId}` : null;
}

/**
 * Works out the photo change for an update: a new upload replaces the current
 * photo, and `remove` clears it. Returns the value to store in `photoId`
 * (undefined = leave unchanged) and the old photo to delete after the update.
 */
export async function resolvePhotoChange(
  tx: Prisma.TransactionClient,
  schoolId: string,
  currentId: string | null,
  upload: PhotoUpload | null,
  remove: boolean,
): Promise<{ photoId: string | null | undefined; staleId: string | null }> {
  if (upload) return { photoId: await createPhoto(tx, schoolId, upload), staleId: currentId };
  if (remove && currentId) return { photoId: null, staleId: currentId };
  return { photoId: undefined, staleId: null };
}
