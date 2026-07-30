export { createUuidV5 } from "./uuid-v5";
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
