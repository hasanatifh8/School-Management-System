import Link from "next/link";
import { BookOpenText, CalendarClock, Download, ExternalLink, Eye, FileText, Search, Trash2, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, IconTile, PagedList, buttonVariants, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatISO, isoDate, shortDate, todayISO } from "@/lib/attendance-shared";
import { INLINE_TYPES } from "@/lib/documents";
import type { MaterialRow } from "@/lib/materials";
import { KIND_META, MATERIAL_KINDS, type MaterialKindKey } from "@/lib/materials-shared";
import { sectionLabel } from "@/lib/queries";

const posted = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const sizeOf = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Filters from the URL: ?kind=, ?subject=, ?q=. */
export function readMaterialFilters(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return { kind: MATERIAL_KINDS.find((k) => k === one("kind")) ?? null, subject: one("subject"), q: one("q").trim().slice(0, 80) };
}

/**
 * Study material as cards, with type chips, a subject filter and a search
 * (all in the URL). `remove` adds a Delete button to the rows it allows.
 */
export function MaterialList({
  rows,
  base,
  filters,
  remove,
  showClass = true,
}: {
  rows: MaterialRow[];
  base: string;
  filters: ReturnType<typeof readMaterialFilters>;
  remove?: (m: MaterialRow) => (() => Promise<ActionState>) | null;
  showClass?: boolean;
}) {
  const subjects = [...new Map(rows.filter((r) => r.subject).map((r) => [r.subject!.id, r.subject!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(
    (r) =>
      (!filters.kind || r.kind === filters.kind) &&
      (!filters.subject || r.subjectId === filters.subject) &&
      words.every((w) => `${r.title} ${r.description ?? ""} ${r.subject?.name ?? ""} ${r.uploadedBy}`.toLowerCase().includes(w)),
  );
  const href = (changes: Partial<Record<"kind" | "subject" | "q", string | null>>) => {
    const p = new URLSearchParams();
    const all = { kind: filters.kind ?? "", subject: filters.subject, q: filters.q, ...changes };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `${base}${p.size ? `${base.includes("?") ? "&" : "?"}${p}` : ""}`;
  };
  const count = (k: MaterialKindKey) => rows.filter((r) => r.kind === k).length;
  const today = todayISO();

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-6 lg:flex-row lg:items-center">
        <form action={base.split("?")[0]} className="flex flex-1 flex-wrap items-center gap-2">
          {base.includes("?") &&
            [...new URLSearchParams(base.split("?")[1])].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {filters.kind && <input type="hidden" name="kind" value={filters.kind} />}
          <label className="relative min-w-48 flex-1 sm:max-w-sm">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input name="q" defaultValue={filters.q} placeholder="Search title or topic" className={`${inputClass} !pl-9`} />
          </label>
          {subjects.length > 0 && (
            <select name="subject" defaultValue={filters.subject} className={`${selectClass} !w-48`} aria-label="Subject">
              <option value="">All subjects</option>
              {subjects.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className={`${buttonVariants.secondary} !py-2`}>
            Apply
          </button>
          {(filters.q || filters.subject) && (
            <Link href={href({ q: null, subject: null })} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
              <X className="h-4 w-4" /> Clear
            </Link>
          )}
        </form>
      </div>
      <nav aria-label="Type" className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3 sm:px-6">
        <Link href={href({ kind: null })} className={`rounded-full px-3 py-1 text-xs font-medium ${!filters.kind ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}>
          All <span className="tabular-nums opacity-75">{rows.length}</span>
        </Link>
        {MATERIAL_KINDS.filter((k) => count(k) || filters.kind === k).map((k) => (
          <Link key={k} href={href({ kind: k })} className={`rounded-full px-3 py-1 text-xs font-medium ${filters.kind === k ? "bg-accent text-white" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}>
            {KIND_META[k].plural} <span className="tabular-nums opacity-75">{count(k)}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState icon={BookOpenText} title={rows.length ? "Nothing matches" : "No study material yet"} description={rows.length ? "Try another type, subject or search." : "Notes, assignments and test papers appear here once they're posted."} />
      ) : (
        <PagedList pageSize={12} noun="items">
          {shown.map((m) => {
            const del = remove?.(m);
            const due = m.dueDate ? isoDate(m.dueDate) : null;
            const inline = m.mimeType ? INLINE_TYPES.has(m.mimeType) : false;
            return (
              <li key={m.id} className="flex flex-wrap items-start gap-3 px-4 py-4 sm:px-6">
                <IconTile icon={FileText} tone={KIND_META[m.kind].tile} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-fg">{m.title}</p>
                    <Badge tone={KIND_META[m.kind].badge}>{KIND_META[m.kind].label}</Badge>
                    {m.subject && <Badge tone="sky">{m.subject.name}</Badge>}
                    {due && (
                      <Badge tone={due < today ? "red" : "amber"} dot>
                        <CalendarClock className="h-3 w-3" /> Due {formatISO(due, shortDate)}
                      </Badge>
                    )}
                  </div>
                  {m.description && <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-fg-2">{m.description}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {showClass && <>{m.section ? sectionLabel(m.section) : `${m.class.name} · all sections`} · </>}
                    {m.uploadedBy} · {posted.format(m.createdAt)}
                    {m.size ? ` · ${sizeOf(m.size)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.fileId && inline && (
                    <a href={`/api/materials/${m.id}`} target="_blank" rel="noopener" className={`${buttonVariants.secondary} !px-3 !py-1.5 text-xs`}>
                      <Eye className="h-3.5 w-3.5" /> Open
                    </a>
                  )}
                  {m.fileId && (
                    <a href={`/api/materials/${m.id}?download`} className={`${buttonVariants.ghost} !px-3 !py-1.5 text-xs`}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  )}
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noopener noreferrer" className={`${buttonVariants.ghost} !px-3 !py-1.5 text-xs`}>
                      <ExternalLink className="h-3.5 w-3.5" /> Link
                    </a>
                  )}
                  {del && (
                    <ActionForm action={del} compact className="flex flex-row-reverse items-center">
                      <SubmitButton variant="ghost" size="sm" confirm={`Delete “${m.title}”?`} icon={<Trash2 className="h-4 w-4" />}>
                        <span className="sr-only">Delete {m.title}</span>
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </PagedList>
      )}
    </div>
  );
}
