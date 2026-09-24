"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { AadhaarInput } from "@/components/aadhaar-input";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_LABELS,
  DOCUMENT_TYPES_FOR,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_LABEL,
  NUMBERED_TYPES,
  formatBytes,
  type DocumentOwnerKind,
} from "@/lib/document-types";
import type { DocumentType } from "@/generated/prisma/enums";

export function DocumentUploadForm({
  ownerKind,
  action,
}: {
  ownerKind: DocumentOwnerKind;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const types = DOCUMENT_TYPES_FOR[ownerKind];
  const [type, setType] = useState<DocumentType>(types[0]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // A successful upload resets the form; keep local state in step with it.
  useEffect(() => {
    const form = wrapperRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setType(types[0]);
      setFile(null);
      setFileError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [types]);

  const numbered = NUMBERED_TYPES[type];

  return (
    <ActionForm action={action} className="space-y-4">
      {(state) => (
        <div ref={wrapperRef} className="space-y-4">
          <Field label="Document type" name="type" errors={state.fieldErrors} required>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className={selectClass}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          {numbered && (
            <Field label={numbered.label} name="documentNumber" errors={state.fieldErrors} hint="Optional. Shown masked.">
              {type === "AADHAAR" ? (
                <AadhaarInput name="documentNumber" />
              ) : (
                <input
                  name="documentNumber"
                  placeholder={numbered.placeholder}
                  autoComplete="off"
                  className={`${inputClass} font-mono`}
                />
              )}
            </Field>
          )}

          <Field label="Title" name="title" errors={state.fieldErrors} hint={`Optional. Defaults to “${DOCUMENT_LABELS[type]}”.`}>
            <input
              name="title"
              maxLength={120}
              placeholder={type === "EDUCATION_CERTIFICATE" ? "e.g. B.Ed degree" : DOCUMENT_LABELS[type]}
              className={inputClass}
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              File<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <label
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 ${
                fileError ? "border-rose-300 bg-rose-50/40" : file ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"
              }`}
            >
              <FileUp className="h-6 w-6 text-indigo-500" />
              {file ? (
                <>
                  <span className="max-w-full truncate text-sm font-medium text-slate-800">{file.name}</span>
                  <span className="text-xs text-slate-500">{formatBytes(file.size)} · click to change</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-slate-700">Click to choose a file</span>
                  <span className="text-xs text-slate-500">PDF, JPG, PNG, WebP, DOC or DOCX · max {MAX_DOCUMENT_LABEL}</span>
                </>
              )}
              <input
                type="file"
                name="file"
                required
                accept={DOCUMENT_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  if (picked && picked.size > MAX_DOCUMENT_BYTES) {
                    // Stop here: larger bodies are rejected by the server before our action runs.
                    e.target.value = "";
                    setFile(null);
                    setFileError(`${picked.name} is ${formatBytes(picked.size)}. The limit is ${MAX_DOCUMENT_LABEL}.`);
                    return;
                  }
                  setFileError(null);
                  setFile(picked);
                }}
              />
            </label>
            {(fileError ?? state.fieldErrors?.file?.[0]) && (
              <span className="mt-1.5 block text-xs font-medium text-rose-600">
                {fileError ?? state.fieldErrors?.file?.[0]}
              </span>
            )}
          </div>

          <SubmitButton icon={<Upload className="h-4 w-4" />}>Upload document</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
