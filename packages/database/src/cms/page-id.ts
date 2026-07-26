/**
 * CMS page identity bridging.
 *
 * Application / CmsPage ids are opaque strings (`page_home`, `custom_*`, …).
 * Phase B Postgres uses UUID primary keys with `stable_key` holding the app id.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when value is a UUID suitable for Postgres uuid columns. */
export function isCmsUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Application-facing page key stored in `cms_pages.stable_key`.
 * Prefer explicit stableKey; otherwise the CmsPage.id (builtin or custom_*).
 */
export function cmsPageStableKey(
  pageId: string,
  stableKey?: string | null,
): string {
  if (stableKey != null && stableKey.length > 0) return stableKey;
  return pageId;
}

/**
 * Public CmsPageRecord.id: prefer stable_key so callers keep using page_home etc.
 */
export function cmsPageRecordId(row: {
  id: string;
  stable_key: string | null;
}): string {
  return row.stable_key ?? row.id;
}

/** Pass through only real UUIDs (e.g. created_by); never send usernames to uuid cols. */
export function uuidOrNull(value: string | null | undefined): string | null {
  if (value == null || value.length === 0) return null;
  return isCmsUuid(value) ? value : null;
}
