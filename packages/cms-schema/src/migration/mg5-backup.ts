/**
 * MG5 backup / restore — pure artifact shapes + restore transform.
 * Filesystem I/O belongs in the operator script, not here.
 */

import type { BuiltinCmsPage, CmsPage } from "../types";
import { checksumOf } from "./checksum";
import { pageContentHash } from "./mg5-pipeline";
import { MG5_MIGRATION_VERSION, type Mg5MigrationVersion } from "./mg5-version";

export type Mg5PageBackupRecord = {
  pageId: string;
  pageKey: string | null;
  draftRevisionNumber: number;
  schemaVersionHint: number;
  layoutVersion: number;
  contentHash: string;
  /** Exact draft payload prior to migration. */
  payload: CmsPage;
  capturedAt: string;
};

export type Mg5BackupArtifact = {
  artifactVersion: 1;
  migrationVersion: Mg5MigrationVersion;
  runId: string;
  environment: string;
  createdAt: string;
  pages: Mg5PageBackupRecord[];
  artifactChecksum: string;
};

export function buildPageBackupRecord(input: {
  page: BuiltinCmsPage;
  draftRevisionNumber: number;
  schemaVersionHint: number;
  capturedAt: string;
}): Mg5PageBackupRecord {
  const payload = structuredClone(input.page);
  return {
    pageId: payload.id,
    pageKey: payload.pageKey ?? null,
    draftRevisionNumber: input.draftRevisionNumber,
    schemaVersionHint: input.schemaVersionHint,
    layoutVersion: payload.layoutVersion,
    contentHash: pageContentHash(payload),
    payload,
    capturedAt: input.capturedAt,
  };
}

export function finalizeBackupArtifact(input: {
  runId: string;
  environment: string;
  createdAt: string;
  pages: Mg5PageBackupRecord[];
}): Mg5BackupArtifact {
  const base = {
    artifactVersion: 1 as const,
    migrationVersion: MG5_MIGRATION_VERSION,
    runId: input.runId,
    environment: input.environment,
    createdAt: input.createdAt,
    pages: input.pages,
  };
  return {
    ...base,
    artifactChecksum: checksumOf(base),
  };
}

export function verifyBackupArtifact(artifact: Mg5BackupArtifact): {
  ok: boolean;
  reason?: string;
} {
  const { artifactChecksum, ...rest } = artifact;
  const expected = checksumOf(rest);
  if (expected !== artifactChecksum) {
    return { ok: false, reason: "Backup artifact checksum mismatch." };
  }
  if (artifact.migrationVersion !== MG5_MIGRATION_VERSION) {
    return {
      ok: false,
      reason: `Backup migrationVersion ${artifact.migrationVersion} != ${MG5_MIGRATION_VERSION}`,
    };
  }
  return { ok: true };
}

/**
 * Restore a single page from backup when the live page still matches the
 * post-migration expectation (or when operator forces restore of unchanged target).
 * Divergence detection is the caller's responsibility via hashes/revisions.
 */
export function restorePageFromBackup(
  backup: Mg5PageBackupRecord,
): BuiltinCmsPage {
  const page = structuredClone(backup.payload);
  if (page.kind !== "builtin") {
    throw new Error(`Backup page ${backup.pageId} is not builtin.`);
  }
  return page;
}
