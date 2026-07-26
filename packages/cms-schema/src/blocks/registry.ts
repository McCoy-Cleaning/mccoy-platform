import type { Block, BlockType } from "../types";
import type { CmsBlockDataDefinition } from "./definition";
import { catalogDefinitions } from "./catalog";

/** Every registered block type (catalog keys). Runtime source for tests and pickers. */
export const ALL_BLOCK_TYPES = Object.keys(catalogDefinitions) as BlockType[];

/**
 * Compile-time exhaustiveness: catalog keys must equal the BlockType union.
 * If this errors, add/remove a catalog entry or update BlockType in types.ts.
 */
type CatalogKey = keyof typeof catalogDefinitions;
type MissingFromCatalog = Exclude<BlockType, CatalogKey>;
type ExtraInCatalog = Exclude<CatalogKey, BlockType>;
type AssertCatalogMatchesBlockType =
  MissingFromCatalog | ExtraInCatalog extends never ? true : {
    missing: MissingFromCatalog;
    extra: ExtraInCatalog;
  };
const _assertCatalogMatchesBlockType: AssertCatalogMatchesBlockType = true;
void _assertCatalogMatchesBlockType;

export const blockDataRegistry = catalogDefinitions as unknown as Record<
  BlockType,
  CmsBlockDataDefinition
>;

/** Block types with publishable: false (none expected after conversion stubs shipped). */
export const UNPUBLISHABLE_BLOCK_TYPES = ALL_BLOCK_TYPES.filter(
  (type) => !blockDataRegistry[type].capabilities.publishable,
) as BlockType[];

/** Block types allowed in the template picker and safe to publish when valid. */
export const PUBLISHABLE_BLOCK_TYPES = ALL_BLOCK_TYPES.filter(
  (type) => blockDataRegistry[type].capabilities.publishable,
) as BlockType[];

export function isPublishableBlockType(type: BlockType): boolean {
  return blockDataRegistry[type].capabilities.publishable;
}

export function isUnpublishableBlockType(type: BlockType): boolean {
  return !isPublishableBlockType(type);
}

export function getBlockDataDefinition(type: BlockType): CmsBlockDataDefinition {
  const def = blockDataRegistry[type];
  if (!def) {
    throw new Error(`Unknown block type: ${type}`);
  }
  return def;
}

/**
 * Ensures a template/picker type list covers exactly {@link PUBLISHABLE_BLOCK_TYPES}
 * (stubs hidden from picker; no extras).
 */
export function assertPickerTypesMatchRegistry(pickerTypes: readonly BlockType[]): void {
  const sortedPicker = [...new Set(pickerTypes)].sort();
  const sortedPublishable = [...PUBLISHABLE_BLOCK_TYPES].sort();
  const missing = sortedPublishable.filter((t) => !sortedPicker.includes(t));
  const extra = sortedPicker.filter((t) => !sortedPublishable.includes(t));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Template picker out of sync with publishable block registry. missing=[${missing.join(", ")}] extra=[${extra.join(", ")}]`,
    );
  }
}

export function parseBlockData(
  type: BlockType,
  data: unknown,
): { ok: true; data: unknown; dataVersion: number } | { ok: false; error: string } {
  const def = getBlockDataDefinition(type);
  const normalized = def.normalize(data);
  const parsed = def.schema.safeParse(normalized);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige sectiegegevens",
    };
  }
  return { ok: true, data: parsed.data, dataVersion: def.dataVersion };
}

export function toPersistedBlockData(
  type: BlockType,
  data: unknown,
): { data: Record<string, unknown>; dataVersion: number } {
  const parsed = parseBlockData(type, data);
  if (!parsed.ok) {
    const def = getBlockDataDefinition(type);
    const fallback = def.createDefault();
    return {
      data: JSON.parse(JSON.stringify(fallback)) as Record<string, unknown>,
      dataVersion: def.dataVersion,
    };
  }
  return {
    data: JSON.parse(JSON.stringify(parsed.data)) as Record<string, unknown>,
    dataVersion: parsed.dataVersion,
  };
}

export function createDefaultBlock(type: BlockType): Block {
  const def = getBlockDataDefinition(type);
  const { data, dataVersion } = toPersistedBlockData(type, def.createDefault());
  return {
    id: `block_${Math.random().toString(36).slice(2, 10)}`,
    type,
    data,
    dataVersion,
  };
}
