// Document types and rules shared by the server and the upload form.
import type { DocumentType } from "@/generated/prisma/enums";

export type DocumentOwnerKind = "student" | "teacher";

// Vercel rejects request bodies over 4.5 MB, so files stay under that with room for form overhead.
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_DOCUMENT_LABEL = "4 MB";

/** What the file picker offers; the server re-checks the actual bytes. */
export const DOCUMENT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp";

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  AADHAAR: "Aadhaar card",
  PAN: "PAN card",
  BIRTH_CERTIFICATE: "Birth certificate",
  TRANSFER_CERTIFICATE: "Transfer certificate (TC)",
  MARKSHEET: "Marksheet / report card",
  CASTE_CERTIFICATE: "Caste certificate",
  MEDICAL_CERTIFICATE: "Medical certificate",
  RESUME: "Resume / CV",
  EDUCATION_CERTIFICATE: "Educational certificate",
  EXPERIENCE_LETTER: "Experience letter",
  ADDRESS_PROOF: "Address proof",
  OTHER: "Other",
};

/** Types offered for each kind of person, in menu order. */
export const DOCUMENT_TYPES_FOR: Record<DocumentOwnerKind, DocumentType[]> = {
  student: [
    "AADHAAR",
    "BIRTH_CERTIFICATE",
    "TRANSFER_CERTIFICATE",
    "MARKSHEET",
    "CASTE_CERTIFICATE",
    "MEDICAL_CERTIFICATE",
    "ADDRESS_PROOF",
    "OTHER",
  ],
  teacher: [
    "AADHAAR",
    "PAN",
    "RESUME",
    "EDUCATION_CERTIFICATE",
    "EXPERIENCE_LETTER",
    "ADDRESS_PROOF",
    "MEDICAL_CERTIFICATE",
    "OTHER",
  ],
};

/** Key documents shown as a checklist on the profile. */
export const EXPECTED_DOCUMENTS: Record<DocumentOwnerKind, DocumentType[]> = {
  student: ["AADHAAR", "BIRTH_CERTIFICATE", "TRANSFER_CERTIFICATE", "MARKSHEET"],
  teacher: ["AADHAAR", "PAN", "RESUME", "EDUCATION_CERTIFICATE"],
};

/** Types that carry an ID number. */
export const NUMBERED_TYPES: Partial<Record<DocumentType, { label: string; placeholder: string }>> = {
  AADHAAR: { label: "Aadhaar number", placeholder: "1234 5678 9012" },
  PAN: { label: "PAN", placeholder: "ABCDE1234F" },
};

/**
 * Normalises and validates an ID number for its document type.
 * Returns the value to store, or an error message.
 */
export function normalizeDocumentNumber(
  type: DocumentType,
  raw: string,
): { value: string | null } | { error: string } {
  const input = raw.trim();
  if (!input || !NUMBERED_TYPES[type]) return { value: null };
  if (type === "AADHAAR") {
    const digits = input.replace(/[\s-]/g, "");
    if (!/^\d{12}$/.test(digits)) return { error: "Aadhaar number must be 12 digits." };
    return { value: digits.replace(/(\d{4})(?=\d)/g, "$1 ") };
  }
  const pan = input.toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return { error: "PAN must look like ABCDE1234F." };
  return { value: pan };
}

/** Shows only the last 4 characters of an ID number. */
export function maskDocumentNumber(value: string) {
  const plain = value.replace(/\s/g, "");
  return `${"•".repeat(Math.max(0, plain.length - 4))}${plain.slice(-4)}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
