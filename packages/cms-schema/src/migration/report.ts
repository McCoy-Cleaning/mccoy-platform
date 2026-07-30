export type PageMigrationReport = {
  pageId: string;
  pageKey: string;
  fromVersion: number;
  toVersion: number;
  legacySectionsFound: string[];
  blocksCreated: Array<{
    blockId: string;
    type: string;
    sourceFixedKey: string;
    role: string;
  }>;
  preservedExistingBlocks: number;
  unknownLegacyFields: Array<{
    fixedKey: string;
    path: string;
  }>;
  warnings: string[];
  errors: string[];
  publishableAfterMigration: boolean;
  legacyChecksum: string;
  migratedChecksum: string;
  /** True when dry-run only — nothing persisted. */
  dryRun: boolean;
};

export function emptyMigrationReport(
  partial: Pick<PageMigrationReport, "pageId" | "pageKey" | "fromVersion" | "toVersion" | "dryRun">,
): PageMigrationReport {
  return {
    ...partial,
    legacySectionsFound: [],
    blocksCreated: [],
    preservedExistingBlocks: 0,
    unknownLegacyFields: [],
    warnings: [],
    errors: [],
    publishableAfterMigration: false,
    legacyChecksum: "",
    migratedChecksum: "",
  };
}
