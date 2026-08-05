/** Stable id helper for CMS list items (no domain imports). */
export function createItemId(prefix = "item"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
