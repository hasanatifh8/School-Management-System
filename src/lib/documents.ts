import "server-only";
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_LABEL } from "@/lib/document-types";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Types that browsers can safely display inline; everything else is downloaded. */
export const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/** Identifies the file from its first bytes rather than trusting the browser. */
function sniffDocumentType(b: Uint8Array, fileName: string): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  const ext = fileName.toLowerCase().split(".").pop();
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  // .docx is a zip archive; .doc is an OLE compound file.
  if (ext === "docx" && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return DOCX;
  if (ext === "doc" && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((v, i) => b[i] === v)) {
    return "application/msword";
  }
  return null;
}

export type DocumentUpload = {
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  fileName: string;
  size: number;
};

export async function readDocumentUpload(
  formData: FormData,
): Promise<{ file: DocumentUpload } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_DOCUMENT_BYTES) return { error: `File must be ${MAX_DOCUMENT_LABEL} or smaller.` };

  const data = new Uint8Array(await file.arrayBuffer());
  const fileName = file.name.replace(/[\\/\r\n"]/g, "_").slice(0, 150) || "document";
  const mimeType = sniffDocumentType(data, fileName);
  if (!mimeType) return { error: "Only PDF, JPG, PNG, WebP, DOC or DOCX files are allowed." };
  return { file: { data, mimeType, fileName, size: file.size } };
}
