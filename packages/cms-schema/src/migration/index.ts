export { createUuidV5 } from "./uuidV5";
export {
  CMS_MIGRATION_NAMESPACE,
  BLOCKS_ONLY_LAYOUT_VERSION,
  createMigrationBlockId,
  type MigrationBlockIdentity,
} from "./block-id";
export {
  layoutMigrationStatusSchema,
  layoutMigrationMetadataSchema,
  parseLayoutMigrationMetadata,
  isMigrationVerifiedForRender,
  type LayoutMigrationStatus,
  type LayoutMigrationMetadata,
} from "./metadata";
export { checksumOf, stableStringify } from "./checksum";
export {
  emptyMigrationReport,
  type PageMigrationReport,
} from "./report";
export {
  createRollbackSnapshot,
  type MigrationRollbackSnapshot,
} from "./rollback";
export {
  FIXED_SECTION_MIGRATION_ROLES,
  type MigrationRoleSpec,
} from "./roles";
export {
  dryRunFixedToBlocksMigration,
  migrationBlockIdsEqual,
  collectUnknownSectionFields,
} from "./dry-run";
export {
  applyFixedToBlocksMigration,
  markMigrationVerified,
  mapFixedSectionToBlockData,
  type ApplyMigrationResult,
} from "./apply";
export {
  canRetireFixedRenderers,
  shouldServeMigratedBlocks,
  type FixedRendererRetirementChecklist,
} from "./retirement";
export {
  fixtureUntouchedHome,
  fixturePartiallyMigratedHome,
  fixtureAlreadyMigratedHome,
  fixtureWithExtraCustomBlocks,
  fixtureMissingSectionContent,
  fixtureMalformedLegacyContent,
  fixtureAboutNlEn,
} from "./fixtures";
export {
  PRODUCTS_BLOCKS_MIGRATION_VERSION,
  productsBlocksMigrationStateSchema,
  productsBlocksMigrationStatusSchema,
  parseProductsBlocksMigrationState,
  productsMigrationBlockId,
  mapProductsMainToTextImageData,
  mapProductsInfoToFeatureGridData,
  remapProductsEnFieldDrafts,
  resolveProductsBlocksLayout,
  forceProductsIntroAssortmentPair,
  shouldServeProductsMigratedBlocks,
  suppressedProductsFixedKeys,
  dedupeProductsPresentationBlocks,
  markProductsBlocksMigrationVerified,
  type ProductsBlocksMigrationState,
  type ProductsBlocksMigrationStatus,
  type ProductsMigrationReport,
  type ResolveProductsBlocksResult,
} from "./products-blocks";
export {
  productAssortmentTemplateData,
  productIntroTemplateData,
  defaultProductsIntroMetrics,
} from "./products-templates";
export {
  HOME_HERO_BLOCKS_MIGRATION_VERSION,
  homeHeroBlocksMigrationStateSchema,
  homeHeroBlocksMigrationStatusSchema,
  parseHomeHeroBlocksMigrationState,
  homeHeroMigrationBlockId,
  mapHomeHeroToHeroBlockData,
  remapHomeHeroEnFieldDrafts,
  resolveHomeHeroBlocksLayout,
  shouldServeHomeHeroMigratedBlock,
  suppressedHomeHeroFixedKeys,
  markHomeHeroBlocksMigrationVerified,
  seedHeroBlockFromHomeHeroContent,
  type HomeHeroBlocksMigrationState,
  type HomeHeroBlocksMigrationStatus,
  type HomeHeroMigrationReport,
  type ResolveHomeHeroBlocksResult,
} from "./home-hero-blocks";
export {
  ABOUT_BLOCKS_MIGRATION_VERSION,
  aboutBlocksMigrationStateSchema,
  aboutBlocksMigrationStatusSchema,
  parseAboutBlocksMigrationState,
  aboutMigrationBlockId,
  DEFAULT_ABOUT_INTRO_PILLARS_NL,
  DEFAULT_ABOUT_INTRO_PILLARS_EN,
  mapAboutIntroToCenteredData,
  mapAboutPillarToTextImageData,
  remapAboutEnFieldDrafts,
  resolveAboutBlocksLayout,
  shouldServeAboutMigratedBlocks,
  suppressedAboutFixedKeys,
  markAboutBlocksMigrationVerified,
  type AboutBlocksMigrationState,
  type AboutBlocksMigrationStatus,
  type AboutMigrationReport,
  type ResolveAboutBlocksResult,
} from "./about-blocks";
export {
  OFFERTE_BLOCKS_MIGRATION_VERSION,
  offerteBlocksMigrationStateSchema,
  offerteBlocksMigrationStatusSchema,
  parseOfferteBlocksMigrationState,
  offerteMainMigrationBlockId,
  offerteFormMigrationBlockId,
  mapOfferteMainToHeroBlockData,
  mapOfferteFormToQuoteRequestData,
  remapOfferteEnFieldDrafts,
  resolveOfferteBlocksLayout,
  shouldServeOfferteMigratedBlocks,
  suppressedOfferteFixedKeys,
  markOfferteBlocksMigrationVerified,
  type OfferteBlocksMigrationState,
  type OfferteBlocksMigrationStatus,
  type OfferteMigrationReport,
  type ResolveOfferteBlocksResult,
} from "./offerte-blocks";
export {
  LEGAL_BLOCKS_MIGRATION_VERSION,
  LEGAL_PAGE_HEADING_EN,
  legalBlocksMigrationStateSchema,
  legalBlocksMigrationStatusSchema,
  parseLegalBlocksMigrationState,
  legalMainMigrationBlockId,
  mapLegalMainToLegalArticlesData,
  remapLegalEnFieldDrafts,
  seedLegalHeadingEnDraft,
  resolveLegalBlocksLayout,
  shouldServeLegalMigratedBlock,
  suppressedLegalFixedKeys,
  markLegalBlocksMigrationVerified,
  type LegalBlocksMigrationState,
  type LegalBlocksMigrationStatus,
  type LegalMigrationReport,
  type ResolveLegalBlocksResult,
} from "./legal-blocks";

/** MG5 — production-grade fixed→blocks migration qualification */
export {
  MG5_MIGRATION_VERSION,
  MG5_PRODUCTION_CONFIRM_PHRASE,
  type Mg5MigrationVersion,
} from "./mg5-version";
export {
  buildMg5MigrationMatrix,
  MG5_MIGRATION_MATRIX,
  mg5MatrixEntriesForPageKey,
  mg5MatrixEntry,
  assertMg5MatrixCoversM5Inventory,
  mg5MatrixSummary,
  type Mg5MigrationEntry,
  type Mg5Qualification,
  type Mg5EligibilityClass,
} from "./mg5-matrix";
export type {
  FixedBlockConflict,
  MigrationOperation,
  MigrationWarning,
  MigrationValidationResult,
  FixedToBlockMigrationInput,
  FixedToBlockMigrationResult,
  Mg5PageMigrationResult,
  Mg5MigrationReport,
} from "./mg5-contract";
export {
  classifyFixedBlockConflict,
  classifyPageFixedBlockConflicts,
  conflictsBlockApply,
} from "./mg5-conflicts";
export {
  MG5_MAX_SUPPORTED_SCHEMA_VERSION,
  pageContentHash,
  migrateFixedToBlocks,
  assertMigrationIdempotent,
} from "./mg5-pipeline";
export {
  buildPageBackupRecord,
  finalizeBackupArtifact,
  verifyBackupArtifact,
  restorePageFromBackup,
  type Mg5PageBackupRecord,
  type Mg5BackupArtifact,
} from "./mg5-backup";
export {
  assertApplyGates,
  buildQualificationRecord,
  runMg5DryRun,
  runMg5Apply,
  runMg5Rollback,
  MG5_EVENTS,
  type Mg5Environment,
  type Mg5OperatorPageRecord,
  type Mg5PersistencePort,
  type Mg5BackupPort,
  type Mg5QualificationRecord,
  type Mg5OperatorOptions,
} from "./mg5-operator";
