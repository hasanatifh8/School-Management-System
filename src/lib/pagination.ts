// Page number and size for list pages, read from the URL (?page=2&perPage=50).
// No server-only imports, so the client pagination bar can share PAGE_SIZES.

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

type Params = Record<string, string | string[] | undefined>;

function readInt(params: Params, key: string) {
  const v = params[key];
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

/**
 * The page to show out of `total` rows. An out-of-range page (e.g. after a
 * filter shrinks the list) falls back to the nearest real page.
 */
export function paginate(params: Params, total: number, defaultSize: number = DEFAULT_PAGE_SIZE) {
  const requested = readInt(params, "perPage");
  const perPage = (PAGE_SIZES as readonly number[]).includes(requested ?? 0) ? requested! : defaultSize;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(readInt(params, "page") ?? 1, 1), pages);
  return { page, pages, perPage, total, skip: (page - 1) * perPage, take: perPage };
}

export type Paging = ReturnType<typeof paginate>;
