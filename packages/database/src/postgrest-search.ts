/**
 * Search-term hardening for PostgREST filter builders.
 *
 * `.or("name.ilike.%<term>%,sku.ilike.%<term>%")` interpolates the term into
 * PostgREST's filter grammar. An unsanitized term can inject extra clauses,
 * because `,` separates clauses and `()` groups them, which widens the OR group
 * beyond the intended columns. `%`, `_` and `*` are `ilike` wildcards and let a
 * caller turn a narrow search into a full-table scan.
 *
 * `.` is deliberately preserved: it is only meaningful as a column/operator
 * separator at the start of a clause, never inside a value, and stripping it
 * would break email and domain searches.
 */

/** Longest search term forwarded to the database. */
export const POSTGREST_SEARCH_MAX_LENGTH = 200;

/** Characters that change how PostgREST parses a filter, or that act as wildcards. */
const UNSAFE_FILTER_CHARS = /[,()%_*\\]/g;

export function sanitizePostgrestSearchTerm(
  raw: string,
  maxLength: number = POSTGREST_SEARCH_MAX_LENGTH,
): string {
  return raw
    .replace(UNSAFE_FILTER_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, maxLength));
}

/**
 * Clamp a caller-supplied row limit. Defence in depth for data-layer functions
 * that may be reached by a future caller without a validated schema.
 */
export function clampQueryLimit(
  requested: number | undefined,
  fallback: number,
  max: number,
): number {
  const value = Number.isFinite(requested) ? Math.trunc(requested as number) : fallback;
  if (value < 1) return 1;
  return Math.min(value, max);
}
