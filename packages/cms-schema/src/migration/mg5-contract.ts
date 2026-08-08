/**
 * MG5 canonical migration contract — pure types and validation shapes.
 * Core transforms must not perform I/O.
 */

import type { BuiltinCmsPage } from "../types";
import type { ValidateIssue } from "../pipeline";
import type { Mg5MigrationVersion } from "./mg5-version";

export type FixedBlockConflict =
  | "none"
  | "equivalent"
  | "target_already_exists"
  | "content_conflict"
  | "ambiguous";

export type MigrationOperation =
  | {
      op: "create_block";
      blockId: string;
      blockType: string;
      sourceFixedKey: string;
      role: string;
    }
  | {
      op: "update_block";
      blockId: string;
      blockType: string;
      sourceFixedKey: string;
      role: string;
    }
  | {
      op: "replace_layout_fixed";
      fixedKey: string;
      blockIds: string[];
    }
  | {
      op: "remap_en_path";
      from: string;
      to: string;
    }
  | {
      op: "stamp_migration_state";
      field: string;
      status: string;
    }
  | {
      op: "suppress_fixed";
      fixedKey: string;
    };

export type MigrationWarning = {
  code: string;
  message: string;
  pageId?: string;
  path?: string;
  severity: "info" | "warning";
};

export type MigrationValidationResult = {
  ok: boolean;
  issues: ValidateIssue[];
};

export type FixedToBlockMigrationInput = {
  page: BuiltinCmsPage;
  migrationContext: {
    schemaVersion: number;
    pageKey: string;
    migrationVersion: Mg5MigrationVersion;
    /**
     * family — dual-read family resolvers only (default for canary).
     * full — family resolvers then wholesale remaining fixed keys.
     */
    mode?: "family" | "full";
    /**
     * When true (default for MG5 operator), Producten must not reinject missing optional sections.
     * Editor dual-read repair remains available outside this flag.
     */
    strictAbsence?: boolean;
  };
};

export type FixedToBlockMigrationResult = {
  changed: boolean;
  beforeHash: string;
  afterHash: string;
  migratedPage: BuiltinCmsPage;
  operations: MigrationOperation[];
  warnings: MigrationWarning[];
  validation: MigrationValidationResult;
  conflicts: Array<{
    fixedKey: string;
    blockId?: string;
    conflict: FixedBlockConflict;
    detail: string;
  }>;
  migrationVersion: Mg5MigrationVersion;
  pageId: string;
  pageKey: string;
  sourceSchemaVersion: number;
  targetSchemaVersion: number;
  /** Fail-closed: any content_conflict / ambiguous blocks apply. */
  blocked: boolean;
};

export type Mg5PageMigrationResult = {
  pageId: string;
  pageKey: string;
  beforeHash: string;
  afterHash: string;
  changed: boolean;
  blocked: boolean;
  operations: MigrationOperation[];
  conflicts: FixedToBlockMigrationResult["conflicts"];
  warnings: MigrationWarning[];
  validation: MigrationValidationResult;
  backupStatus: "not_required" | "pending" | "written" | "failed" | "restored";
  applyStatus: "dry-run" | "skipped" | "applied" | "refused" | "failed";
  postWriteVerification: "not_run" | "passed" | "failed";
  draftRevisionNumber?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type Mg5MigrationReport = {
  runId: string;
  mode: "dry-run" | "apply" | "rollback";
  startedAt: string;
  finishedAt: string;
  migrationVersion: Mg5MigrationVersion;
  environment: string;
  pagesScanned: number;
  pagesEligible: number;
  pagesChanged: number;
  pagesUnchanged: number;
  pagesBlocked: number;
  pagesFailed: number;
  blocksCreated: number;
  blocksSkippedExisting: number;
  conflicts: Array<{
    pageId: string;
    fixedKey: string;
    conflict: FixedBlockConflict;
    detail: string;
  }>;
  warnings: MigrationWarning[];
  results: Mg5PageMigrationResult[];
  qualificationStale: boolean;
  backupDir?: string;
};
