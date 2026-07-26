import type { PreviewSnapshot, PreviewStatus } from "./types";

/**
 * Mirrors admin/storefront `cms.getPreviewStatus` session semantics:
 * - no snapshot → locked (preview pane never opened / snapshot cleared)
 * - snapshot present but tracked version cleared or mismatched → outdated (stale)
 * - snapshot version matches tracked version → up_to_date (frozen snapshot)
 *
 * Draft edits call `markPreviewStale` (clear tracked version) without deleting the
 * last snapshot, so the iframe keeps showing the frozen capture until the pane
 * is opened again (admin captures on “Toon preview”).
 */
export function resolvePreviewStatus(
  snap: PreviewSnapshot | null | undefined,
  trackedVersion: number | undefined,
): PreviewStatus {
  if (!snap) return "locked";
  if (trackedVersion === undefined || trackedVersion !== snap.version) return "outdated";
  return "up_to_date";
}
