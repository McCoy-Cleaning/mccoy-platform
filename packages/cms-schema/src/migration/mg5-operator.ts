/**
 * MG5 operator orchestration — fail-closed gates.
 * Persistence is injected; this module never opens network/FS itself.
 */

import { CMS_SCHEMA_VERSION, type BuiltinCmsPage, type CmsPage } from "../types";
import { MG5_MIGRATION_VERSION, MG5_PRODUCTION_CONFIRM_PHRASE } from "./mg5-version";
import { migrateFixedToBlocks, pageContentHash } from "./mg5-pipeline";
import {
  buildPageBackupRecord,
  finalizeBackupArtifact,
  restorePageFromBackup,
  verifyBackupArtifact,
  type Mg5BackupArtifact,
  type Mg5PageBackupRecord,
} from "./mg5-backup";
import type {
  FixedToBlockMigrationResult,
  Mg5MigrationReport,
  Mg5PageMigrationResult,
  MigrationWarning,
} from "./mg5-contract";
import { createHash, randomUUID } from "node:crypto";

export type Mg5Environment = "local" | "staging" | "production" | "test";

export type Mg5OperatorPageRecord = {
  pageId: string;
  pageKey: string;
  draftRevisionNumber: number;
  payload: BuiltinCmsPage;
};

export type Mg5PersistencePort = {
  listBuiltinPages(filter?: {
    pageId?: string;
    pageKey?: string;
  }): Promise<Mg5OperatorPageRecord[]>;
  saveDraftAtomic(input: {
    pageId: string;
    expectedRevisionNumber: number;
    payload: CmsPage;
  }): Promise<{ draftRevisionNumber: number }>;
  readDraft(pageId: string): Promise<Mg5OperatorPageRecord | null>;
};

export type Mg5BackupPort = {
  writeArtifact(artifact: Mg5BackupArtifact): Promise<{ path: string }>;
  readArtifact(runId: string): Promise<Mg5BackupArtifact | null>;
};

export type Mg5QualificationRecord = {
  runId: string;
  migrationVersion: string;
  environment: string;
  mode: "dry-run";
  pageHashes: Record<string, { beforeHash: string; draftRevisionNumber: number }>;
  createdAt: string;
  reportChecksum: string;
};

export type Mg5OperatorOptions = {
  environment: Mg5Environment;
  mode: "dry-run" | "apply" | "rollback";
  pageId?: string;
  pageKey?: string;
  migrationMode?: "family" | "full";
  /** Required for apply — must match a prior dry-run. */
  qualifiedRunId?: string;
  /** Required for production apply. */
  confirmProduction?: string;
  /** Clock injection for deterministic tests. */
  now?: () => string;
  /** ID injection for deterministic tests. */
  createRunId?: () => string;
};

function emptyReport(
  runId: string,
  mode: Mg5MigrationReport["mode"],
  environment: string,
  startedAt: string,
): Mg5MigrationReport {
  return {
    runId,
    mode,
    startedAt,
    finishedAt: startedAt,
    migrationVersion: MG5_MIGRATION_VERSION,
    environment,
    pagesScanned: 0,
    pagesEligible: 0,
    pagesChanged: 0,
    pagesUnchanged: 0,
    pagesBlocked: 0,
    pagesFailed: 0,
    blocksCreated: 0,
    blocksSkippedExisting: 0,
    conflicts: [],
    warnings: [],
    results: [],
    qualificationStale: false,
  };
}

export function assertApplyGates(options: Mg5OperatorOptions): {
  ok: boolean;
  reason?: string;
} {
  if (options.mode !== "apply") return { ok: true };
  if (!options.qualifiedRunId) {
    return { ok: false, reason: "Apply requires --qualified-run <dry-run-id>." };
  }
  if (options.environment === "production") {
    if (options.confirmProduction !== MG5_PRODUCTION_CONFIRM_PHRASE) {
      return {
        ok: false,
        reason: `Production apply requires --confirm-production "${MG5_PRODUCTION_CONFIRM_PHRASE}".`,
      };
    }
  }
  return { ok: true };
}

export function buildQualificationRecord(
  report: Mg5MigrationReport,
  pages: Mg5OperatorPageRecord[],
  results: FixedToBlockMigrationResult[],
): Mg5QualificationRecord {
  const pageHashes: Mg5QualificationRecord["pageHashes"] = {};
  for (const page of pages) {
    const result = results.find((r) => r.pageId === page.pageId);
    if (!result) continue;
    pageHashes[page.pageId] = {
      beforeHash: result.beforeHash,
      draftRevisionNumber: page.draftRevisionNumber,
    };
  }
  const createdAt = report.startedAt;
  const base = {
    runId: report.runId,
    migrationVersion: report.migrationVersion,
    environment: report.environment,
    mode: "dry-run" as const,
    pageHashes,
    createdAt,
  };
  return {
    ...base,
    reportChecksum: createHash("sha256")
      .update(JSON.stringify(base))
      .digest("hex"),
  };
}

function migrateRecord(
  record: Mg5OperatorPageRecord,
  migrationMode: "family" | "full",
): FixedToBlockMigrationResult {
  return migrateFixedToBlocks({
    page: record.payload,
    migrationContext: {
      schemaVersion: CMS_SCHEMA_VERSION,
      pageKey: record.pageKey,
      migrationVersion: MG5_MIGRATION_VERSION,
      mode: migrationMode,
      strictAbsence: true,
    },
  });
}

function toPageResult(
  record: Mg5OperatorPageRecord,
  migrated: FixedToBlockMigrationResult,
  applyStatus: Mg5PageMigrationResult["applyStatus"],
  backupStatus: Mg5PageMigrationResult["backupStatus"],
  postWriteVerification: Mg5PageMigrationResult["postWriteVerification"] = "not_run",
  error?: { code: string; message: string },
): Mg5PageMigrationResult {
  return {
    pageId: record.pageId,
    pageKey: record.pageKey,
    beforeHash: migrated.beforeHash,
    afterHash: migrated.afterHash,
    changed: migrated.changed,
    blocked: migrated.blocked,
    operations: migrated.operations,
    conflicts: migrated.conflicts,
    warnings: migrated.warnings,
    validation: migrated.validation,
    backupStatus,
    applyStatus,
    postWriteVerification,
    draftRevisionNumber: record.draftRevisionNumber,
    errorCode: error?.code,
    errorMessage: error?.message,
  };
}

/**
 * Dry-run: migrate in memory, never call saveDraftAtomic.
 */
export async function runMg5DryRun(
  persistence: Mg5PersistencePort,
  options: Omit<Mg5OperatorOptions, "mode"> & { mode?: "dry-run" },
): Promise<{ report: Mg5MigrationReport; qualification: Mg5QualificationRecord }> {
  const now = options.now ?? (() => new Date().toISOString());
  const runId = (options.createRunId ?? (() => `mg5_${randomUUID()}`))();
  const startedAt = now();
  const report = emptyReport(runId, "dry-run", options.environment, startedAt);
  const pages = await persistence.listBuiltinPages({
    pageId: options.pageId,
    pageKey: options.pageKey,
  });
  report.pagesScanned = pages.length;
  const migrationMode = options.migrationMode ?? "family";
  const migratedResults: FixedToBlockMigrationResult[] = [];

  for (const record of pages) {
    const migrated = migrateRecord(record, migrationMode);
    migratedResults.push(migrated);
    if (migrated.blocked) {
      report.pagesBlocked += 1;
      report.conflicts.push(
        ...migrated.conflicts.map((c) => ({
          pageId: record.pageId,
          fixedKey: c.fixedKey,
          conflict: c.conflict,
          detail: c.detail,
        })),
      );
    } else if (migrated.changed) {
      report.pagesEligible += 1;
      report.pagesChanged += 1;
      report.blocksCreated += migrated.operations.filter((o) => o.op === "create_block").length;
      report.blocksSkippedExisting += migrated.conflicts.filter(
        (c) => c.conflict === "target_already_exists" || c.conflict === "equivalent",
      ).length;
    } else {
      report.pagesUnchanged += 1;
    }
    if (!migrated.validation.ok) {
      report.pagesFailed += 1;
    }
    report.warnings.push(...migrated.warnings);
    report.results.push(
      toPageResult(record, migrated, "dry-run", "not_required"),
    );
  }

  report.finishedAt = now();
  const qualification = buildQualificationRecord(report, pages, migratedResults);
  return { report, qualification };
}

/**
 * Apply: requires qualification, backup, CAS revision, post-write verify.
 * Never writes when dry-run gates fail.
 */
export async function runMg5Apply(
  persistence: Mg5PersistencePort,
  backupPort: Mg5BackupPort,
  qualification: Mg5QualificationRecord,
  options: Mg5OperatorOptions,
): Promise<Mg5MigrationReport> {
  const gate = assertApplyGates(options);
  const now = options.now ?? (() => new Date().toISOString());
  const runId = options.qualifiedRunId ?? qualification.runId;
  const startedAt = now();
  const report = emptyReport(runId, "apply", options.environment, startedAt);

  if (!gate.ok) {
    report.pagesFailed = 1;
    report.warnings.push({
      code: "mg5.apply_gate_failed",
      message: gate.reason ?? "Apply gate failed.",
      severity: "warning",
    });
    report.finishedAt = now();
    return report;
  }

  if (qualification.migrationVersion !== MG5_MIGRATION_VERSION) {
    report.qualificationStale = true;
    report.warnings.push({
      code: "mg5.qualification_version_mismatch",
      message: "Qualified dry-run migrationVersion does not match current MG5 version.",
      severity: "warning",
    });
    report.finishedAt = now();
    return report;
  }

  if (qualification.environment !== options.environment) {
    report.qualificationStale = true;
    report.warnings.push({
      code: "mg5.qualification_environment_mismatch",
      message: "Qualified dry-run environment does not match apply environment.",
      severity: "warning",
    });
    report.finishedAt = now();
    return report;
  }

  const pages = await persistence.listBuiltinPages({
    pageId: options.pageId,
    pageKey: options.pageKey,
  });
  report.pagesScanned = pages.length;
  const migrationMode = options.migrationMode ?? "family";

  // Preflight: revision + hash must still match qualification.
  const backupPages: Mg5PageBackupRecord[] = [];
  const planned: Array<{
    record: Mg5OperatorPageRecord;
    migrated: FixedToBlockMigrationResult;
  }> = [];

  for (const record of pages) {
    const q = qualification.pageHashes[record.pageId];
    if (!q) {
      // Page not in qualification cohort — skip.
      continue;
    }
    const liveHash = pageContentHash(record.payload);
    if (
      liveHash !== q.beforeHash ||
      record.draftRevisionNumber !== q.draftRevisionNumber
    ) {
      report.qualificationStale = true;
      report.pagesBlocked += 1;
      report.results.push({
        pageId: record.pageId,
        pageKey: record.pageKey,
        beforeHash: liveHash,
        afterHash: liveHash,
        changed: false,
        blocked: true,
        operations: [],
        conflicts: [],
        warnings: [
          {
            code: "mg5.stale_qualification",
            message:
              "Source changed since dry-run (hash or draft revision). Re-run dry-run.",
            pageId: record.pageId,
            severity: "warning",
          },
        ],
        validation: { ok: true, issues: [] },
        backupStatus: "not_required",
        applyStatus: "refused",
        postWriteVerification: "not_run",
        draftRevisionNumber: record.draftRevisionNumber,
        errorCode: "mg5.stale_qualification",
        errorMessage: "Stale qualification — refuse overwrite.",
      });
      continue;
    }

    const migrated = migrateRecord(record, migrationMode);
    if (migrated.blocked || !migrated.validation.ok) {
      report.pagesBlocked += 1;
      report.results.push(
        toPageResult(record, migrated, "refused", "not_required", "not_run", {
          code: "mg5.blocked_or_invalid",
          message: "Page blocked by conflicts or validation.",
        }),
      );
      continue;
    }
    if (!migrated.changed) {
      report.pagesUnchanged += 1;
      report.results.push(toPageResult(record, migrated, "skipped", "not_required"));
      continue;
    }

    backupPages.push(
      buildPageBackupRecord({
        page: record.payload,
        draftRevisionNumber: record.draftRevisionNumber,
        schemaVersionHint: CMS_SCHEMA_VERSION,
        capturedAt: now(),
      }),
    );
    planned.push({ record, migrated });
  }

  if (report.qualificationStale) {
    report.warnings.push({
      code: "mg5.apply_aborted_stale",
      message: "Apply aborted — stale qualification detected before any writes.",
      severity: "warning",
    });
    report.finishedAt = now();
    return report;
  }

  if (planned.length === 0) {
    report.finishedAt = now();
    return report;
  }

  const artifact = finalizeBackupArtifact({
    runId,
    environment: options.environment,
    createdAt: now(),
    pages: backupPages,
  });
  let backupPath: string;
  try {
    const written = await backupPort.writeArtifact(artifact);
    backupPath = written.path;
    report.backupDir = backupPath;
  } catch (err) {
    report.pagesFailed = planned.length;
    report.warnings.push({
      code: "mg5.backup_failed",
      message: err instanceof Error ? err.message : "Backup write failed.",
      severity: "warning",
    });
    report.finishedAt = now();
    return report;
  }

  for (const { record, migrated } of planned) {
    report.pagesEligible += 1;
    try {
      const saved = await persistence.saveDraftAtomic({
        pageId: record.pageId,
        expectedRevisionNumber: record.draftRevisionNumber,
        payload: migrated.migratedPage,
      });
      const reread = await persistence.readDraft(record.pageId);
      if (!reread) {
        report.pagesFailed += 1;
        report.results.push(
          toPageResult(record, migrated, "failed", "written", "failed", {
            code: "mg5.verify_missing",
            message: "Post-write re-read returned null.",
          }),
        );
        continue;
      }
      const liveHash = pageContentHash(reread.payload);
      if (liveHash !== migrated.afterHash) {
        report.pagesFailed += 1;
        report.results.push(
          toPageResult(record, migrated, "failed", "written", "failed", {
            code: "mg5.verify_hash_mismatch",
            message: "Post-write hash does not match expected migrated hash.",
          }),
        );
        continue;
      }
      report.pagesChanged += 1;
      report.blocksCreated += migrated.operations.filter((o) => o.op === "create_block").length;
      report.results.push({
        ...toPageResult(record, migrated, "applied", "written", "passed"),
        draftRevisionNumber: saved.draftRevisionNumber,
      });
    } catch (err) {
      report.pagesFailed += 1;
      const message = err instanceof Error ? err.message : "Apply write failed.";
      report.results.push(
        toPageResult(record, migrated, "failed", "written", "not_run", {
          code: "mg5.apply_write_failed",
          message,
        }),
      );
    }
  }

  report.finishedAt = now();
  return report;
}

/**
 * Rollback pages from a backup artifact using CAS against current revision.
 * Refuses when live content no longer matches the migrated after-hash from apply report
 * (optional) — basic divergence: if caller supplies expectedAfterHashes.
 */
export async function runMg5Rollback(
  persistence: Mg5PersistencePort,
  artifact: Mg5BackupArtifact,
  options: {
    environment: Mg5Environment;
    expectedAfterHashes?: Record<string, string>;
    now?: () => string;
  },
): Promise<Mg5MigrationReport> {
  const now = options.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const report = emptyReport(artifact.runId, "rollback", options.environment, startedAt);
  const verified = verifyBackupArtifact(artifact);
  if (!verified.ok) {
    report.pagesFailed = 1;
    report.warnings.push({
      code: "mg5.backup_invalid",
      message: verified.reason ?? "Invalid backup.",
      severity: "warning",
    });
    report.finishedAt = now();
    return report;
  }

  report.pagesScanned = artifact.pages.length;
  for (const backup of artifact.pages) {
    const live = await persistence.readDraft(backup.pageId);
    if (!live) {
      report.pagesFailed += 1;
      report.results.push({
        pageId: backup.pageId,
        pageKey: backup.pageKey ?? "unknown",
        beforeHash: "",
        afterHash: backup.contentHash,
        changed: false,
        blocked: true,
        operations: [],
        conflicts: [],
        warnings: [],
        validation: { ok: false, issues: [] },
        backupStatus: "failed",
        applyStatus: "failed",
        postWriteVerification: "not_run",
        errorCode: "mg5.rollback_missing_page",
        errorMessage: "Live page missing.",
      });
      continue;
    }

    const expectedAfter = options.expectedAfterHashes?.[backup.pageId];
    if (expectedAfter) {
      const liveHash = pageContentHash(live.payload);
      if (liveHash !== expectedAfter) {
        report.pagesBlocked += 1;
        report.results.push({
          pageId: backup.pageId,
          pageKey: backup.pageKey ?? live.pageKey,
          beforeHash: liveHash,
          afterHash: liveHash,
          changed: false,
          blocked: true,
          operations: [],
          conflicts: [],
          warnings: [
            {
              code: "mg5.rollback_diverged",
              message: "Live page diverged after migration; refuse automatic rollback.",
              pageId: backup.pageId,
              severity: "warning",
            } satisfies MigrationWarning,
          ],
          validation: { ok: true, issues: [] },
          backupStatus: "written",
          applyStatus: "refused",
          postWriteVerification: "not_run",
          draftRevisionNumber: live.draftRevisionNumber,
          errorCode: "mg5.rollback_diverged",
          errorMessage: "Diverged since migration.",
        });
        continue;
      }
    }

    try {
      const restored = restorePageFromBackup(backup);
      const saved = await persistence.saveDraftAtomic({
        pageId: backup.pageId,
        expectedRevisionNumber: live.draftRevisionNumber,
        payload: restored,
      });
      const reread = await persistence.readDraft(backup.pageId);
      const ok =
        !!reread && pageContentHash(reread.payload) === backup.contentHash;
      if (!ok) {
        report.pagesFailed += 1;
        report.results.push({
          pageId: backup.pageId,
          pageKey: backup.pageKey ?? live.pageKey,
          beforeHash: pageContentHash(live.payload),
          afterHash: backup.contentHash,
          changed: true,
          blocked: false,
          operations: [],
          conflicts: [],
          warnings: [],
          validation: { ok: false, issues: [] },
          backupStatus: "restored",
          applyStatus: "failed",
          postWriteVerification: "failed",
          draftRevisionNumber: saved.draftRevisionNumber,
          errorCode: "mg5.rollback_verify_failed",
          errorMessage: "Restore re-read hash mismatch.",
        });
        continue;
      }
      report.pagesChanged += 1;
      report.results.push({
        pageId: backup.pageId,
        pageKey: backup.pageKey ?? live.pageKey,
        beforeHash: pageContentHash(live.payload),
        afterHash: backup.contentHash,
        changed: true,
        blocked: false,
        operations: [],
        conflicts: [],
        warnings: [],
        validation: { ok: true, issues: [] },
        backupStatus: "restored",
        applyStatus: "applied",
        postWriteVerification: "passed",
        draftRevisionNumber: saved.draftRevisionNumber,
      });
    } catch (err) {
      report.pagesFailed += 1;
      report.results.push({
        pageId: backup.pageId,
        pageKey: backup.pageKey ?? live.pageKey,
        beforeHash: pageContentHash(live.payload),
        afterHash: backup.contentHash,
        changed: false,
        blocked: false,
        operations: [],
        conflicts: [],
        warnings: [],
        validation: { ok: false, issues: [] },
        backupStatus: "failed",
        applyStatus: "failed",
        postWriteVerification: "not_run",
        errorCode: "mg5.rollback_write_failed",
        errorMessage: err instanceof Error ? err.message : "Rollback failed.",
      });
    }
  }

  report.finishedAt = now();
  return report;
}

/** Structured event names for operator logging (no content payloads). */
export const MG5_EVENTS = {
  runStarted: "mg5.run.started",
  pageQualified: "mg5.page.qualified",
  pageSkipped: "mg5.page.skipped",
  pageConflict: "mg5.page.conflict",
  pageApplied: "mg5.page.applied",
  pageVerifyFailed: "mg5.page.verify_failed",
  runCompleted: "mg5.run.completed",
} as const;
