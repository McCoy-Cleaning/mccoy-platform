import type { BuiltinCmsPage } from "../types";
import { checksumOf } from "./checksum";

export type MigrationRollbackSnapshot = {
  id: string;
  pageId: string;
  capturedAt: string;
  /** Full page clone before mutation — includes unknown fields as stored. */
  page: BuiltinCmsPage;
  /** Raw sectionContent bag for recovery (may include unknown keys). */
  legacySectionContent: Record<string, unknown>;
  checksum: string;
};

export function createRollbackSnapshot(
  page: BuiltinCmsPage,
  snapshotId: string,
  capturedAt = new Date().toISOString(),
): MigrationRollbackSnapshot {
  const cloned = structuredClone(page);
  const legacySectionContent = (cloned.sectionContent ?? {}) as Record<string, unknown>;
  return {
    id: snapshotId,
    pageId: page.id,
    capturedAt,
    page: cloned,
    legacySectionContent,
    checksum: checksumOf({
      layout: cloned.layout,
      blocks: cloned.blocks,
      sectionContent: legacySectionContent,
      layoutVersion: cloned.layoutVersion,
      enFieldDrafts: cloned.enFieldDrafts ?? {},
    }),
  };
}
