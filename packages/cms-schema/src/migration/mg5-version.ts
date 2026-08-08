/**
 * MG5 fixed→blocks migration qualification version.
 * Distinct from {@link CMS_SCHEMA_VERSION} and layoutVersion.
 * Bump only when the deterministic transform contract changes.
 */
export const MG5_MIGRATION_VERSION = "fixed-block/v1" as const;

export type Mg5MigrationVersion = typeof MG5_MIGRATION_VERSION;

/** Production confirm phrase required for `--environment production --apply`. */
export const MG5_PRODUCTION_CONFIRM_PHRASE = "MIGRATE PRODUCTION CMS" as const;
