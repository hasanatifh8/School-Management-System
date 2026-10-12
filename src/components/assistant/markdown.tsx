import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { APP_PAGES } from "@/lib/assistant/pages";

/**
 * Renders the small Markdown subset the assistant writes: paragraphs,
 * headings, bullet/numbered lists, tables, **bold**, *italic*, `code` and
 * [links](/admin/…) to pages of the Admin Portal. Builds React elements (no
 * HTML injection), so model output can't add markup; a link anywhere else
 * (another site, a script) shows as plain text.
 */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={i} className="mt-2 font-semibold text-fg">
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) body.push(cells(lines[i++]));
      blocks.push(
        <div key={i} className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                {head.map((h, j) => (
                  <th key={j} className="whitespace-nowrap px-3 py-2 font-medium text-muted">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {body.map((row, r) => (
                <tr key={r}>
                  {head.map((_, j) => (
                    <td key={j} className="px-3 py-2 text-fg-2">
                      {inline(row[j] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(
        <p key={i} className="border-l-2 border-line-strong pl-3 text-fg-2">
          {quote.map((q, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(q)}
            </Fragment>
          ))}
        </p>,
      );
      continue;
    }
    const listItem = /^\s*([-*•]|\d+[.)])\s+/;
    if (listItem.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && listItem.test(lines[i])) items.push(lines[i++].replace(listItem, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={i} className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-muted`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !listItem.test(lines[i]) && !/^#{1,4}\s/.test(lines[i]) && !/^\s*>/.test(lines[i]) && !isTableRow(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]); // a lone table-looking line
    blocks.push(
      <p key={i}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="space-y-3 text-sm leading-relaxed text-fg-2">{blocks}</div>;
}

/** "Open Fee desk" for a bare link to a known page; else "Open page". */
function pageName(path: string) {
  const bare = path.split("?")[0].replace(/\/$/, "") || "/admin";
  const page = APP_PAGES.find((p) => p.path === bare);
  return page ? `Open ${page.title}` : "Open page";
}

/** Only the Admin Portal's own pages may be linked. */
const INTERNAL = /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/;

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // A bare /admin/… path (no link text) is linked too, named after its page.
  const re = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|(?<![\w(/])\/admin(?:\/[\w\-/]*)?(?:\?[\w\-=&%.]*)?)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("/admin")) {
      const path = t.replace(/[.,;:]+$/, "");
      out.push(
        <Link key={m.index} href={path} className="font-medium text-accent-text underline-offset-4 hover:underline">
          {pageName(path)}
        </Link>,
      );
      if (path.length < t.length) out.push(t.slice(path.length));
    } else if (t.startsWith("[")) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      out.push(
        INTERNAL.test(href) ? (
          <Link key={m.index} href={href} className="font-medium text-accent-text underline-offset-4 hover:underline">
            {/* A path as the link text reads badly: name the page instead. */}
            {label.trim().startsWith("/admin") ? pageName(href) : inline(label)}
          </Link>
        ) : (
          label
        ),
      );
    } else if (t.startsWith("**")) out.push(<strong key={m.index} className="font-semibold text-fg">{inline(t.slice(2, -2))}</strong>);
    else if (t.startsWith("`")) out.push(<code key={m.index} className="rounded bg-surface-3 px-1 py-0.5 text-xs">{t.slice(1, -1)}</code>);
    else out.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
