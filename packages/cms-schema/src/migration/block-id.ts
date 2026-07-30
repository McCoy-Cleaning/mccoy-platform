import { createUuidV5 } from "./uuidV5";

/**
 * Stable CMS migration namespace (UUID). Never change — regenerating would
 * rewrite every migrated block identity.
 */
export const CMS_MIGRATION_NAMESPACE = "6b8a4e2c-9f1d-4a7b-8c3e-5d2f1a0b9e7c" as const;

/** Target layout version after fixed→blocks migration (Gate 5+). */
export const BLOCKS_ONLY_LAYOUT_VERSION = 7 as const;

export type MigrationBlockIdentity = {
  pageId: string;
  fixedKey: string;
  role: string;
  /** Provenance only — not mixed into the UUID name string. */
  layoutVersion: number;
};

/**
 * Deterministic block ID for a fixed-section migration role.
 * Name: `${pageId}:${fixedKey}:${role}` — never title, locale, position, content, or time.
 */
export function createMigrationBlockId(input: {
  pageId: string;
  fixedKey: string;
  role: string;
}): string {
  return createUuidV5(
    `${input.pageId}:${input.fixedKey}:${input.role}`,
    CMS_MIGRATION_NAMESPACE,
  );
}
