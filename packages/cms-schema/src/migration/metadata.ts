import { z } from "zod";

export const layoutMigrationStatusSchema = z.enum([
  "not_started",
  "validated",
  "migrated",
  "verified",
  "rollback_required",
]);

export type LayoutMigrationStatus = z.infer<typeof layoutMigrationStatusSchema>;

export const layoutMigrationMetadataSchema = z.object({
  status: layoutMigrationStatusSchema,
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().nonnegative(),
  migratedAt: z.string().min(1),
  legacyChecksum: z.string().min(1),
  migratedChecksum: z.string().min(1),
  migrationId: z.string().min(1),
  rollbackSnapshotId: z.string().min(1).optional(),
});

export type LayoutMigrationMetadata = z.infer<typeof layoutMigrationMetadataSchema>;

/** Storefront may use migrated blocks only when status is verified. */
export function isMigrationVerifiedForRender(
  meta: LayoutMigrationMetadata | null | undefined,
): boolean {
  return meta?.status === "verified";
}

export function parseLayoutMigrationMetadata(
  raw: unknown,
): LayoutMigrationMetadata | null {
  const parsed = layoutMigrationMetadataSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
