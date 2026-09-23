import { CircleCheck, CircleDashed, Download, Eye, FileImage, FileText, FolderOpen, Trash2, Upload } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, buttonVariants } from "@/components/ui";
import {
  DOCUMENT_LABELS,
  EXPECTED_DOCUMENTS,
  formatBytes,
  maskDocumentNumber,
  type DocumentOwnerKind,
} from "@/lib/document-types";
import type { DocumentType } from "@/generated/prisma/enums";
import { deleteDocument, uploadDocument } from "./actions";
import { DocumentUploadForm } from "./document-upload-form";

export type DocumentRow = {
  id: string;
  type: DocumentType;
  title: string;
  documentNumber: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function FileIcon({ mimeType }: { mimeType: string }) {
  const image = mimeType.startsWith("image/");
  const pdf = mimeType === "application/pdf";
  const Icon = image ? FileImage : FileText;
  const tone = pdf ? "bg-rose-50 text-rose-600" : image ? "bg-sky-50 text-sky-600" : "bg-indigo-50 text-indigo-600";
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** Documents tab for a student or teacher profile: checklist, list and upload form. */
export function DocumentsPanel({
  ownerKind,
  ownerId,
  documents,
}: {
  ownerKind: DocumentOwnerKind;
  ownerId: string;
  documents: DocumentRow[];
}) {
  const uploadedTypes = new Set(documents.map((d) => d.type));
  const expected = EXPECTED_DOCUMENTS[ownerKind];
  const done = expected.filter((t) => uploadedTypes.has(t)).length;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card
          title="Key documents"
          description={`${done} of ${expected.length} uploaded`}
          action={
            <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-slate-100 sm:block">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                style={{ width: `${(done / expected.length) * 100}%` }}
              />
            </div>
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {expected.map((t) => {
              const ok = uploadedTypes.has(t);
              return (
                <li
                  key={t}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                    ok ? "bg-emerald-50/70 text-emerald-800" : "bg-slate-50 text-slate-500"
                  }`}
                >
                  {ok ? (
                    <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <CircleDashed className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="font-medium">{DOCUMENT_LABELS[t]}</span>
                  {!ok && <span className="ml-auto text-xs">Missing</span>}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="All documents" description={`${documents.length} file(s)`} padded={false}>
          {documents.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No documents yet"
              description="Upload Aadhaar, certificates and other records using the form."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <FileIcon mimeType={d.mimeType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/documents/${d.id}`}
                        target="_blank"
                        rel="noopener"
                        className="truncate font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {d.title}
                      </a>
                      {d.title !== DOCUMENT_LABELS[d.type] && <Badge>{DOCUMENT_LABELS[d.type]}</Badge>}
                      {d.documentNumber && (
                        <span className="font-mono text-xs tracking-wider text-slate-500">
                          {maskDocumentNumber(d.documentNumber)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {d.fileName} · {formatBytes(d.size)} · Uploaded {dateFormat.format(d.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/api/documents/${d.id}`}
                      target="_blank"
                      rel="noopener"
                      className={buttonVariants.ghost}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only">View</span>
                    </a>
                    <a href={`/api/documents/${d.id}?download=1`} className={buttonVariants.ghost} title="Download">
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download</span>
                    </a>
                    <ActionForm action={deleteDocument.bind(null, d.id)} compact className="flex items-center gap-2">
                      <SubmitButton
                        variant="dangerGhost"
                        size="sm"
                        confirm={`Delete “${d.title}”? This cannot be undone.`}
                        icon={<Trash2 className="h-4 w-4" />}
                      >
                        <span className="sr-only">Delete {d.title}</span>
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Upload document" icon={Upload} className="self-start">
        <DocumentUploadForm ownerKind={ownerKind} action={uploadDocument.bind(null, ownerKind, ownerId)} />
      </Card>
    </div>
  );
}
