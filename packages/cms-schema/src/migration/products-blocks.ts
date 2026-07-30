/**
 * Producten-first fixed→blocks pilot.
 * Single schema-level authority — apps call resolveProductsBlocksLayout; only admin persists.
 */

import { z } from "zod";
import type { BuiltinCmsPage, Block, BlockType } from "../types";
import type { LayoutItem, FixedLayoutItem, BlockLayoutItem } from "../layout";
import { CURRENT_LAYOUT_VERSION, type FixedSectionKey } from "../sections";
import { getBlockDataDefinition } from "../blocks/registry";
import type { CmsImage, ProductsInfoContent, ProductsMainContent } from "../content";
import { defaultSectionContent } from "../content";
import {
  ensureBuiltinSectionContent,
  migrateProductsCompositeSplit,
  migrateProductsMainText,
} from "../section-content";
import { newFixedLayoutItem } from "../layout";
import { createMigrationBlockId } from "./block-id";

export const PRODUCTS_BLOCKS_MIGRATION_VERSION = 1 as const;

export const productsBlocksMigrationStatusSchema = z.enum([
  "not_started",
  "migrated",
  "verified",
]);

export type ProductsBlocksMigrationStatus = z.infer<
  typeof productsBlocksMigrationStatusSchema
>;

export const productsBlocksMigrationStateSchema = z.object({
  version: z.literal(PRODUCTS_BLOCKS_MIGRATION_VERSION),
  status: productsBlocksMigrationStatusSchema,
  migratedAt: z.string().optional(),
  sources: z.array(z.enum(["products.main", "products.info"])).optional(),
});

export type ProductsBlocksMigrationState = z.infer<
  typeof productsBlocksMigrationStateSchema
>;

export type ProductsMigrationReport = {
  pageId: string;
  fromVersion: number;
  toVersion: number;
  foundProductsMain: boolean;
  foundProductsInfo: boolean;
  createdBlocks: Array<{
    id: string;
    type: "textImage" | "featureGrid";
    source: "products.main" | "products.info";
  }>;
  localePathsRemapped: number;
  warnings: string[];
  errors: string[];
};

export type ResolveProductsBlocksResult = {
  page: BuiltinCmsPage;
  report: ProductsMigrationReport;
  changed: boolean;
};

const PRODUCT_FIXED_KEYS = ["products.main", "products.info"] as const;
type ProductFixedKey = (typeof PRODUCT_FIXED_KEYS)[number];

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function nonEmptyString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parseProductsBlocksMigrationState(
  raw: unknown,
): ProductsBlocksMigrationState | null {
  const parsed = productsBlocksMigrationStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function productsMigrationBlockId(
  pageId: string,
  fixedKey: ProductFixedKey,
): string {
  return createMigrationBlockId({
    pageId,
    fixedKey,
    role: "primary",
  });
}

/** Combine intro + webshop notice for textImage.body. */
export function mapProductsMainToTextImageData(
  content: unknown,
): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const rec = isRecord(content) ? content : {};
  const heading = nonEmptyString(rec.heading) || nonEmptyString(rec.title);
  const intro = typeof rec.intro === "string" ? rec.intro.trim() : "";
  const notice = typeof rec.body === "string" ? rec.body.trim() : "";
  const eyebrow = nonEmptyString(rec.eyebrow);
  if (!heading) {
    warnings.push("products.main: missing heading; using empty title");
  }
  let image =
    rec.image && typeof rec.image === "object" ? (rec.image as CmsImage) : undefined;
  if (!image) {
    const factory = defaultSectionContent("products.main") as ProductsMainContent;
    image = factory.image;
    warnings.push("products.main: flyer restored from factory default");
  }
  const seed = {
    presentation: "productsIntro" as const,
    title: heading || "Producten",
    body: intro || undefined,
    notice: notice || undefined,
    eyebrow: eyebrow || undefined,
    image,
    reverse: false,
  };
  const normalized = getBlockDataDefinition("textImage").normalize(seed) as Record<
    string,
    unknown
  >;
  return { data: normalized, warnings };
}

export function mapProductsInfoToFeatureGridData(
  content: unknown,
): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const rec = isRecord(content) ? content : {};
  const heading = nonEmptyString(rec.heading) || "Productinfo";
  const eyebrow = nonEmptyString(rec.eyebrow);
  const intro = nonEmptyString(rec.intro);
  const cards = Array.isArray(rec.cards)
    ? rec.cards
    : Array.isArray(rec.items)
      ? rec.items
      : [];
  const features = cards.map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id
        : `prod_migrated_${index}`;
    return {
      id,
      icon: typeof row.icon === "string" && row.icon ? row.icon : "sparkles",
      title: nonEmptyString(row.title) || nonEmptyString(row.label) || "Item",
      body: nonEmptyString(row.body) || nonEmptyString(row.description) || "",
      ...(row.link && typeof row.link === "object" ? { link: row.link } : {}),
    };
  });
  const seed = {
    presentation: "productsAssortment" as const,
    title: heading,
    features,
    ...(eyebrow ? { eyebrow } : {}),
    ...(intro ? { intro } : {}),
  };
  const normalized = getBlockDataDefinition("featureGrid").normalize(seed) as Record<
    string,
    unknown
  >;
  return { data: normalized, warnings };
}

/**
 * Remap EN draft paths for Producten fixed → block fields.
 * Intro stays on `body`; webshop notice maps to `notice`; eyebrow/intro preserved.
 */
export function remapProductsEnFieldDrafts(input: {
  pageId: string;
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
  migratedSources: ProductFixedKey[];
}): {
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
  localePathsRemapped: number;
} {
  const drafts = { ...input.enFieldDrafts };
  const sources = { ...input.enFieldDraftSources };
  let localePathsRemapped = 0;

  const move = (from: string, to: string) => {
    if (drafts[from] === undefined) return;
    drafts[to] = drafts[from]!;
    delete drafts[from];
    if (sources[from] !== undefined) {
      sources[to] = sources[from]!;
      delete sources[from];
    }
    localePathsRemapped += 1;
  };

  if (input.migratedSources.includes("products.main")) {
    const id = productsMigrationBlockId(input.pageId, "products.main");
    move("section:products.main:heading", `block:${id}:title`);
    move("section:products.main:intro", `block:${id}:body`);
    move("section:products.main:body", `block:${id}:notice`);
    move("section:products.main:eyebrow", `block:${id}:eyebrow`);
  }

  if (input.migratedSources.includes("products.info")) {
    const id = productsMigrationBlockId(input.pageId, "products.info");
    move("section:products.info:heading", `block:${id}:title`);
    move("section:products.info:eyebrow", `block:${id}:eyebrow`);
    move("section:products.info:intro", `block:${id}:intro`);
    const cardPrefix = "section:products.info:cards:";
    for (const path of Object.keys(drafts)) {
      if (!path.startsWith(cardPrefix)) continue;
      const rest = path.slice(cardPrefix.length); // {id}:title | {id}:description
      const match = /^([^:]+):(title|description)$/.exec(rest);
      if (!match) continue;
      const cardId = match[1]!;
      const field = match[2]!;
      const blockField = field === "description" ? "body" : "title";
      move(path, `block:${id}:features:${cardId}:${blockField}`);
    }
  }

  return { enFieldDrafts: drafts, enFieldDraftSources: sources, localePathsRemapped };
}

function emptyReport(page: BuiltinCmsPage): ProductsMigrationReport {
  return {
    pageId: page.id,
    fromVersion: page.layoutVersion,
    toVersion: page.layoutVersion,
    foundProductsMain: false,
    foundProductsInfo: false,
    createdBlocks: [],
    localePathsRemapped: 0,
    warnings: [],
    errors: [],
  };
}

function hasDeterministicProductsBlocks(page: BuiltinCmsPage): boolean {
  const mainId = productsMigrationBlockId(page.id, "products.main");
  const infoId = productsMigrationBlockId(page.id, "products.info");
  const ids = new Set(page.blocks.map((b) => b.id));
  return ids.has(mainId) || ids.has(infoId);
}

function layoutHasProductFixed(layout: LayoutItem[], key: ProductFixedKey): boolean {
  return layout.some((i) => i.kind === "fixed" && i.key === key);
}

/**
 * Whether storefront/admin should render Producten via migrated blocks
 * (suppress fixed products.main / products.info).
 */
export function shouldServeProductsMigratedBlocks(page: BuiltinCmsPage): boolean {
  const state = parseProductsBlocksMigrationState(page.productsBlocksMigration);
  if (!state) return false;
  if (state.status !== "migrated" && state.status !== "verified") return false;
  return hasDeterministicProductsBlocks(page);
}

function blockHasPresentation(
  page: BuiltinCmsPage,
  type: "textImage" | "featureGrid",
  presentation: string,
): boolean {
  const inLayout = new Set(
    page.layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
  );
  return page.blocks.some((b) => {
    if (b.type !== type || !inLayout.has(b.id)) return false;
    const data = isRecord(b.data) ? b.data : {};
    return data.presentation === presentation;
  });
}

/**
 * Fixed Producten keys that must not render when blocks win.
 * Suppress when migrated, when deterministic migration IDs exist, or when any
 * Producten-presentation block is already in the layout (avoids duplicate Intro).
 */
export function suppressedProductsFixedKeys(page: BuiltinCmsPage): Set<FixedSectionKey> {
  const out = new Set<FixedSectionKey>();
  if (shouldServeProductsMigratedBlocks(page)) {
    out.add("products.main");
    out.add("products.info");
    return out;
  }

  const mainId = productsMigrationBlockId(page.id, "products.main");
  const infoId = productsMigrationBlockId(page.id, "products.info");
  const blockIds = new Set(
    page.layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
  );
  const fixedMain = layoutHasProductFixed(page.layout, "products.main");
  const fixedInfo = layoutHasProductFixed(page.layout, "products.info");

  if (
    fixedMain &&
    (blockIds.has(mainId) || blockHasPresentation(page, "textImage", "productsIntro"))
  ) {
    out.add("products.main");
  }
  if (
    fixedInfo &&
    (blockIds.has(infoId) || blockHasPresentation(page, "featureGrid", "productsAssortment"))
  ) {
    out.add("products.info");
  }
  return out;
}

function presentationOf(block: Block | undefined): string | undefined {
  if (!block || !isRecord(block.data)) return undefined;
  return typeof block.data.presentation === "string" ? block.data.presentation : undefined;
}

/**
 * Keep at most one Producten Intro and one Assortiment section in layout.
 * Prefer deterministic migration IDs when those ids are actually in the layout;
 * also collapse duplicate layout refs to the same blockId.
 */
export function dedupeProductsPresentationBlocks(page: BuiltinCmsPage): {
  page: BuiltinCmsPage;
  changed: boolean;
} {
  if (page.pageKey !== "products") return { page, changed: false };

  const mainId = productsMigrationBlockId(page.id, "products.main");
  const infoId = productsMigrationBlockId(page.id, "products.info");
  const blockById = new Map(page.blocks.map((b) => [b.id, b]));

  const layoutIntroIds: string[] = [];
  const layoutAssortmentIds: string[] = [];
  for (const item of page.layout) {
    if (item.kind !== "block") continue;
    const block = blockById.get(item.blockId);
    const presentation = presentationOf(block);
    if (block?.type === "textImage" && presentation === "productsIntro") {
      layoutIntroIds.push(item.blockId);
    } else if (block?.type === "featureGrid" && presentation === "productsAssortment") {
      layoutAssortmentIds.push(item.blockId);
    }
  }

  const keepIntroId = layoutIntroIds.includes(mainId)
    ? mainId
    : layoutIntroIds[0];
  const keepAssortmentId = layoutAssortmentIds.includes(infoId)
    ? infoId
    : layoutAssortmentIds[0];

  let sawIntro = false;
  let sawAssortment = false;
  const nextLayout: LayoutItem[] = [];
  for (const item of page.layout) {
    if (item.kind !== "block") {
      nextLayout.push(item);
      continue;
    }
    const block = blockById.get(item.blockId);
    const presentation = presentationOf(block);
    if (block?.type === "textImage" && presentation === "productsIntro") {
      if (sawIntro || item.blockId !== keepIntroId) continue;
      sawIntro = true;
      nextLayout.push(item);
      continue;
    }
    if (block?.type === "featureGrid" && presentation === "productsAssortment") {
      if (sawAssortment || item.blockId !== keepAssortmentId) continue;
      sawAssortment = true;
      nextLayout.push(item);
      continue;
    }
    nextLayout.push(item);
  }

  const keepBlockIds = new Set(
    nextLayout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
  );
  // Drop unreferenced Producten presentation duplicates; keep unrelated blocks.
  const nextBlocks = page.blocks.filter((b) => {
    const presentation = presentationOf(b);
    const isProductsPresentation =
      (b.type === "textImage" && presentation === "productsIntro") ||
      (b.type === "featureGrid" && presentation === "productsAssortment");
    if (!isProductsPresentation) return true;
    return keepBlockIds.has(b.id);
  });

  const layoutChanged =
    nextLayout.length !== page.layout.length ||
    nextLayout.some((item, index) => item.id !== page.layout[index]?.id);
  const blocksChanged = nextBlocks.length !== page.blocks.length;
  if (!layoutChanged && !blocksChanged) return { page, changed: false };

  return {
    page: {
      ...structuredClone(page),
      blocks: nextBlocks,
      layout: nextLayout,
    },
    changed: true,
  };
}

function upsertBlock(blocks: Block[], block: Block): Block[] {
  const idx = blocks.findIndex((b) => b.id === block.id);
  if (idx < 0) return [...blocks, block];
  const next = blocks.slice();
  next[idx] = block;
  return next;
}

/** Drop superseded fixed Producten slots once blocks own Intro/Assortiment. */
function stripMigratedProductsFixedSlots(page: BuiltinCmsPage): {
  page: BuiltinCmsPage;
  changed: boolean;
} {
  const state = parseProductsBlocksMigrationState(page.productsBlocksMigration);
  if (!state || (state.status !== "migrated" && state.status !== "verified")) {
    return { page, changed: false };
  }
  const nextLayout = page.layout.filter(
    (i) =>
      !(i.kind === "fixed" && (i.key === "products.main" || i.key === "products.info")),
  );
  if (nextLayout.length === page.layout.length) return { page, changed: false };
  return {
    page: {
      ...structuredClone(page),
      layout: nextLayout,
    },
    changed: true,
  };
}

function layoutFingerprint(page: BuiltinCmsPage): string {
  return page.layout
    .map((item) => {
      if (item.kind === "fixed") return `fixed:${item.key}`;
      const block = page.blocks.find((b) => b.id === item.blockId);
      const presentation =
        block?.data && typeof block.data === "object"
          ? String((block.data as Record<string, unknown>).presentation ?? "none")
          : "none";
      return `${item.blockId}:${block?.type ?? "missing"}:${presentation}`;
    })
    .join("|");
}

function finalizeProductsPresentation(
  page: BuiltinCmsPage,
  report: ProductsMigrationReport,
  priorChanged: boolean,
  state?: ProductsBlocksMigrationState,
): ResolveProductsBlocksResult {
  const stripped = stripMigratedProductsFixedSlots(page);
  if (stripped.changed) {
    report.warnings.push("Removed superseded fixed Producten slots after blocks migration");
  }
  let working = stripped.page;
  let repairedChanged = false;
  const migrationState =
    state ??
    parseProductsBlocksMigrationState(working.productsBlocksMigration) ??
    undefined;
  // Repair missing Intro/Assortiment for migrated pages, and for not_started drafts that
  // already have one presentation picker block (Assortiment-only / Intro-only).
  // Do not invent blocks onto legacy fixed-only layouts with failed migrate (errors only).
  const statusReady =
    migrationState?.status === "migrated" || migrationState?.status === "verified";
  const hasPartialPresentation =
    layoutHasProductsPresentation(working, "productsIntro") ||
    layoutHasProductsPresentation(working, "productsAssortment");
  if (
    migrationState &&
    working.layout.length > 0 &&
    (statusReady || hasPartialPresentation)
  ) {
    const withIntro = ensureMigratedProductsHasIntro(working, migrationState);
    const withAssortment = ensureMigratedProductsHasAssortment(withIntro.page, migrationState);
    repairedChanged = withIntro.changed || withAssortment.changed;
    if (repairedChanged) {
      const nextSources =
        withAssortment.sources ?? withIntro.sources ?? migrationState.sources;
      const nextStatus =
        migrationState.status === "verified" ? "verified" : "migrated";
      // Prefer the repaired page object directly (avoid shallow spread losing layout
      // when exotic draft proxies are involved in the admin store).
      working = structuredClone(withAssortment.page);
      working.productsBlocksMigration = {
        version: PRODUCTS_BLOCKS_MIGRATION_VERSION,
        status: nextStatus,
        migratedAt: migrationState.migratedAt ?? new Date().toISOString(),
        sources: nextSources,
      };
      report.createdBlocks = [
        ...report.createdBlocks,
        ...withIntro.createdBlocks,
        ...withAssortment.createdBlocks,
      ];
      report.warnings.push(...withIntro.warnings, ...withAssortment.warnings);
    } else {
      working = withAssortment.page;
    }
  }
  const deduped = dedupeProductsPresentationBlocks(working);
  if (deduped.changed) {
    report.warnings.push("Removed duplicate Producten presentation blocks");
  }
  let finalPage = deduped.page;
  // Hard guarantee: Assortiment without Intro after "restore" is corruption — inject again.
  if (
    migrationState &&
    layoutHasProductsPresentation(finalPage, "productsAssortment") &&
    !layoutHasProductsPresentation(finalPage, "productsIntro")
  ) {
    const forced = ensureMigratedProductsHasIntro(finalPage, migrationState);
    if (forced.changed) {
      report.warnings.push("products.main: force-injected Intro after repair mismatch");
      report.warnings.push(...forced.warnings);
      report.createdBlocks = [...report.createdBlocks, ...forced.createdBlocks];
      finalPage = structuredClone(forced.page);
      finalPage.productsBlocksMigration = {
        version: PRODUCTS_BLOCKS_MIGRATION_VERSION,
        status: migrationState.status === "verified" ? "verified" : "migrated",
        migratedAt: migrationState.migratedAt ?? new Date().toISOString(),
        sources: forced.sources ?? migrationState.sources,
      };
      repairedChanged = true;
    }
  }
  const inputFp = layoutFingerprint(page);
  const outputFp = layoutFingerprint(finalPage);
  const contentChanged =
    inputFp !== outputFp ||
    JSON.stringify(page.productsBlocksMigration ?? null) !==
      JSON.stringify(finalPage.productsBlocksMigration ?? null);
  return {
    page: finalPage,
    report,
    changed: contentChanged || priorChanged || stripped.changed || repairedChanged || deduped.changed,
  };
}

/**
 * Admin persistence guarantee: non-empty Producten layouts must expose exactly one
 * Intro + one Assortiment presentation. Rebuilds from existing presentation payloads
 * when present, otherwise sectionContent / factory defaults.
 * Intentionally empty migrated layouts stay empty.
 * Preserves editor order when both presentations are already present and healthy.
 */
export function forceProductsIntroAssortmentPair(page: BuiltinCmsPage): {
  page: BuiltinCmsPage;
  changed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (page.pageKey !== "products") return { page, changed: false, warnings };
  if (page.layout.length === 0) return { page, changed: false, warnings };

  const mainId = productsMigrationBlockId(page.id, "products.main");
  const infoId = productsMigrationBlockId(page.id, "products.info");

  if (mainId === infoId || mainId === "----" || infoId === "----") {
    warnings.push("forceProductsIntroAssortmentPair: migration block ids are invalid");
    return { page, changed: false, warnings };
  }

  const hasCorruptId =
    page.blocks.some((b) => b.id === "----") ||
    page.layout.some((item) => item.kind === "block" && item.blockId === "----");

  let introLayoutCount = 0;
  let assortmentLayoutCount = 0;
  for (const item of page.layout) {
    if (item.kind !== "block") continue;
    const block = page.blocks.find((b) => b.id === item.blockId);
    if (isProductsPresentationBlock(block, "productsIntro")) introLayoutCount += 1;
    if (isProductsPresentationBlock(block, "productsAssortment")) assortmentLayoutCount += 1;
  }

  // Healthy pair: do not reorder — editors may place Assortiment above Intro.
  if (!hasCorruptId && introLayoutCount === 1 && assortmentLayoutCount === 1) {
    return { page, changed: false, warnings };
  }

  const existingIntro = page.blocks.find((b) => isProductsPresentationBlock(b, "productsIntro"));
  const existingAssortment = page.blocks.find((b) =>
    isProductsPresentationBlock(b, "productsAssortment"),
  );

  const ensured = ensureBuiltinSectionContent(page);
  const introMapped = mapProductsMainToTextImageData(
    (ensured["products.main"] as ProductsMainContent | undefined) ??
      (defaultSectionContent("products.main") as ProductsMainContent),
  );
  const assortmentMapped = mapProductsInfoToFeatureGridData(
    (ensured["products.info"] as ProductsInfoContent | undefined) ??
      (defaultSectionContent("products.info") as ProductsInfoContent),
  );
  warnings.push(...introMapped.warnings, ...assortmentMapped.warnings);

  const introMerged = mergeProductsIntroData(
    introMapped.data,
    existingIntro && isRecord(existingIntro.data) ? existingIntro.data : undefined,
  );
  const assortmentMerged = mergeProductsAssortmentData(
    assortmentMapped.data,
    existingAssortment && isRecord(existingAssortment.data)
      ? existingAssortment.data
      : undefined,
  );

  const introParsed = getBlockDataDefinition("textImage").schema.safeParse(introMerged);
  const assortmentParsed = getBlockDataDefinition("featureGrid").schema.safeParse(
    assortmentMerged,
  );
  if (!introParsed.success || !assortmentParsed.success) {
    warnings.push("forceProductsIntroAssortmentPair: schema parse failed");
    return { page, changed: false, warnings };
  }

  const introBlock: Block = {
    id: mainId,
    type: "textImage",
    data: introParsed.data as Record<string, unknown>,
  };
  const assortmentBlock: Block = {
    id: infoId,
    type: "featureGrid",
    data: assortmentParsed.data as Record<string, unknown>,
  };

  const dropIds = new Set<string>([mainId, infoId, "----"]);
  if (existingIntro) dropIds.add(existingIntro.id);
  if (existingAssortment) dropIds.add(existingAssortment.id);

  const otherBlocks = page.blocks.filter((b) => !dropIds.has(b.id) && b.id !== "----");

  // Preserve relative Intro/Assortiment order from the current layout when possible.
  const pairOrder: Array<"intro" | "assortment"> = [];
  for (const item of page.layout) {
    if (item.kind !== "block") continue;
    const block = page.blocks.find((b) => b.id === item.blockId);
    if (isProductsPresentationBlock(block, "productsIntro") && !pairOrder.includes("intro")) {
      pairOrder.push("intro");
    } else if (
      isProductsPresentationBlock(block, "productsAssortment") &&
      !pairOrder.includes("assortment")
    ) {
      pairOrder.push("assortment");
    }
  }
  if (!pairOrder.includes("intro")) pairOrder.unshift("intro");
  if (!pairOrder.includes("assortment")) pairOrder.push("assortment");

  const pairLayout: LayoutItem[] = pairOrder.map((role) =>
    role === "intro"
      ? { id: `block:${mainId}`, kind: "block" as const, blockId: mainId }
      : { id: `block:${infoId}`, kind: "block" as const, blockId: infoId },
  );

  const otherLayout = page.layout.filter((item) => {
    if (item.kind !== "block") return true;
    if (item.blockId === "----" || dropIds.has(item.blockId)) return false;
    const block = page.blocks.find((b) => b.id === item.blockId);
    if (isProductsPresentationBlock(block, "productsIntro")) return false;
    if (isProductsPresentationBlock(block, "productsAssortment")) return false;
    return true;
  });

  const nextLayout: LayoutItem[] = [...pairLayout, ...otherLayout];
  const nextBlocks = [...otherBlocks, introBlock, assortmentBlock];

  const prevState = parseProductsBlocksMigrationState(page.productsBlocksMigration);
  const nextPage: BuiltinCmsPage = {
    ...(JSON.parse(JSON.stringify(page)) as BuiltinCmsPage),
    sectionContent: ensured,
    blocks: nextBlocks,
    layout: nextLayout,
    productsBlocksMigration: {
      version: PRODUCTS_BLOCKS_MIGRATION_VERSION,
      status: prevState?.status === "verified" ? "verified" : "migrated",
      migratedAt: prevState?.migratedAt ?? new Date().toISOString(),
      sources: ["products.main", "products.info"],
    },
  };

  const beforeFp = layoutFingerprint(page);
  const afterFp = layoutFingerprint(nextPage);
  const changed = beforeFp !== afterFp;
  if (changed) {
    warnings.push("forceProductsIntroAssortmentPair: repaired Intro/Assortiment pair");
  }
  return { page: nextPage, changed, warnings };
}

/**
 * Canonical Producten resolver. Does not persist.
 *
 * - not_started + fixed Producten keys → migrate once (slot replace)
 * - migrated/verified + empty layout → keep empty (no reseed)
 * - already migrated IDs present → idempotent no-op
 * - always dedupe Intro/Assortiment presentation blocks at the end
 */
export function resolveProductsBlocksLayout(
  page: BuiltinCmsPage,
): ResolveProductsBlocksResult {
  const report = emptyReport(page);

  if (page.pageKey !== "products") {
    return { page, report, changed: false };
  }

  const state =
    parseProductsBlocksMigrationState(page.productsBlocksMigration) ??
    ({
      version: PRODUCTS_BLOCKS_MIGRATION_VERSION,
      status: "not_started",
    } satisfies ProductsBlocksMigrationState);

  // Already migrated/verified: never reseed empty layouts.
  // Upgrade / repair happen once inside finalize (must stay idempotent — admin ensure
  // re-runs on draft writes and must not commit in a loop).
  if (state.status === "migrated" || state.status === "verified") {
    const upgraded = ensureProductsPresentationOnMigratedBlocks(page);
    if (page.layout.length === 0) {
      report.warnings.push("Producten layout empty after migration; not reseeding");
    }
    report.warnings.push(...upgraded.warnings);
    const finalized = finalizeProductsPresentation(
      upgraded.page,
      report,
      upgraded.changed,
      state,
    );
    const forced = forceProductsIntroAssortmentPair(finalized.page);
    if (forced.changed) {
      report.warnings.push(...forced.warnings);
    }
    report.foundProductsMain = forced.page.blocks.some(
      (b) => b.id === productsMigrationBlockId(page.id, "products.main"),
    );
    report.foundProductsInfo = forced.page.blocks.some(
      (b) => b.id === productsMigrationBlockId(page.id, "products.info"),
    );
    return {
      page: forced.page,
      report,
      changed: finalized.changed || forced.changed,
    };
  }

  // Incomplete saved Producten (main-only, no flyer/info) → restore source then migrate.
  const prepared = prepareIncompleteProductsPage(page);
  const working = prepared.page;

  const foundMain = layoutHasProductFixed(working.layout, "products.main");
  const foundInfo = layoutHasProductFixed(working.layout, "products.info");
  report.foundProductsMain = foundMain;
  report.foundProductsInfo = foundInfo;
  report.warnings.push(...prepared.warnings);

  // No Producten fixed keys: never invent blocks into an empty/current layout.
  // If deterministic IDs already exist (partial prior convert), stamp migrated only.
  if (!foundMain && !foundInfo) {
    if (hasDeterministicProductsBlocks(working)) {
      const migratedAt = new Date().toISOString();
      return finalizeProductsPresentation(
        {
          ...working,
          productsBlocksMigration: {
            version: PRODUCTS_BLOCKS_MIGRATION_VERSION,
            status: "migrated",
            migratedAt,
          },
        },
        report,
        true,
      );
    }
    return finalizeProductsPresentation(working, report, prepared.changed);
  }

  const migrated = migrateProductFixedSlots(working, state, report);
  return finalizeProductsPresentation(
    migrated.page,
    migrated.report,
    migrated.changed || prepared.changed,
  );
}

/**
 * Saved Producten records sometimes only kept a short Intro and dropped Assortiment + flyer.
 * Restore missing fixed slots / factory gaps before migrating (not_started only).
 */
function prepareIncompleteProductsPage(page: BuiltinCmsPage): {
  page: BuiltinCmsPage;
  changed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const next = structuredClone(page);
  let sectionContent = { ...(next.sectionContent ?? {}) };

  // Legacy rows stored Intro + assortment cards on products.main — split before migrate.
  const beforeSplit = JSON.stringify(sectionContent);
  sectionContent = migrateProductsCompositeSplit(
    sectionContent as BuiltinCmsPage["sectionContent"],
  );
  if (JSON.stringify(sectionContent) !== beforeSplit) {
    warnings.push("products: split legacy Intro+cards into Intro + Assortiment");
  }

  // Upgrade known legacy Intro stubs (heading/intro/flyer) without clobbering malformed values.
  if (isRecord(sectionContent["products.main"])) {
    const before = sectionContent["products.main"];
    sectionContent = migrateProductsMainText(sectionContent as BuiltinCmsPage["sectionContent"]);
    const after = sectionContent["products.main"];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      warnings.push("products.main: upgraded legacy Intro copy/flyer");
    }
    const main = after as ProductsMainContent | undefined;
    if (main && !main.image) {
      const defMain = defaultSectionContent("products.main") as ProductsMainContent;
      sectionContent = {
        ...sectionContent,
        "products.main": { ...main, image: defMain.image, body: main.body || defMain.body },
      };
      warnings.push("products.main: restored factory flyer image");
    }
  }

  // Assortiment content missing entirely → factory (layout slot restored below).
  if (sectionContent["products.info"] == null) {
    sectionContent = {
      ...sectionContent,
      "products.info": defaultSectionContent("products.info") as ProductsInfoContent,
    };
    warnings.push("products.info: seeded Assortiment content from factory");
  }

  next.sectionContent = sectionContent as BuiltinCmsPage["sectionContent"];

  let layoutChanged = false;
  let layout = next.layout.slice();
  if (!layoutHasProductFixed(layout, "products.main")) {
    layout = [newFixedLayoutItem("products.main"), ...layout];
    layoutChanged = true;
    warnings.push("products.main: restored missing fixed layout slot");
  }
  if (!layoutHasProductFixed(layout, "products.info")) {
    const mainIdx = layout.findIndex((i) => i.kind === "fixed" && i.key === "products.main");
    const infoItem = newFixedLayoutItem("products.info");
    if (mainIdx >= 0) layout.splice(mainIdx + 1, 0, infoItem);
    else layout.push(infoItem);
    layoutChanged = true;
    warnings.push("products.info: restored missing Assortiment fixed layout slot");
  }
  next.layout = layout;

  const changed =
    layoutChanged ||
    JSON.stringify(page.sectionContent) !== JSON.stringify(next.sectionContent);
  return { page: next, changed, warnings };
}

function layoutHasProductsPresentation(
  page: BuiltinCmsPage,
  presentation: "productsIntro" | "productsAssortment",
): boolean {
  const blockById = new Map(page.blocks.map((b) => [b.id, b]));
  return page.layout.some((item) => {
    if (item.kind !== "block") return false;
    return isProductsPresentationBlock(blockById.get(item.blockId), presentation);
  });
}

/**
 * Corruption repair: page has content but no Intro presentation in layout.
 * Does not run on intentionally empty migrated layouts.
 * Note: do not treat a bare mainId layout ref as Intro — it may be the wrong type.
 */
function ensureMigratedProductsHasIntro(
  page: BuiltinCmsPage,
  state: ProductsBlocksMigrationState,
): {
  page: BuiltinCmsPage;
  changed: boolean;
  warnings: string[];
  createdBlocks: ProductsMigrationReport["createdBlocks"];
  sources?: ProductsBlocksMigrationState["sources"];
} {
  const warnings: string[] = [];
  const createdBlocks: ProductsMigrationReport["createdBlocks"] = [];
  if (page.layout.length === 0) {
    return { page, changed: false, warnings, createdBlocks };
  }
  if (layoutHasProductsPresentation(page, "productsIntro")) {
    return { page, changed: false, warnings, createdBlocks };
  }

  const mainId = productsMigrationBlockId(page.id, "products.main");
  const ensured = ensureBuiltinSectionContent(page);
  const mainContent =
    (ensured["products.main"] as ProductsMainContent | undefined) ??
    (defaultSectionContent("products.main") as ProductsMainContent);
  const mapped = mapProductsMainToTextImageData(mainContent);
  warnings.push(...mapped.warnings);
  const parsed = getBlockDataDefinition("textImage").schema.safeParse(mapped.data);
  if (!parsed.success) {
    warnings.push("products.main: could not restore Intro block");
    return { page, changed: false, warnings, createdBlocks };
  }

  const block: Block = {
    id: mainId,
    type: "textImage",
    data: parsed.data as Record<string, unknown>,
  };
  createdBlocks.push({ id: mainId, type: "textImage", source: "products.main" });
  warnings.push("products.main: restored missing Intro presentation block");

  const layoutItem = {
    id: `block:${mainId}`,
    kind: "block" as const,
    blockId: mainId,
  };
  // Drop any existing layout refs to mainId (wrong type / stale), then prepend Intro.
  const layoutWithoutMain = page.layout.filter(
    (item) => !(item.kind === "block" && item.blockId === mainId),
  );
  const prevSources = state.sources ?? ["products.info"];
  const sources = prevSources.includes("products.main")
    ? prevSources
    : (["products.main", ...prevSources] as ProductsBlocksMigrationState["sources"]);

  return {
    page: {
      ...structuredClone(page),
      sectionContent: ensured,
      blocks: upsertBlock(
        page.blocks.filter((b) => b.id !== mainId),
        block,
      ),
      layout: [layoutItem, ...layoutWithoutMain],
    },
    changed: true,
    warnings,
    createdBlocks,
    sources,
  };
}

/**
 * Incomplete prior migration: Intro block present, Assortiment never migrated.
 * If sources already lists products.info, the editor deleted it — do not recreate.
 */
function ensureMigratedProductsHasAssortment(
  page: BuiltinCmsPage,
  state: ProductsBlocksMigrationState,
): {
  page: BuiltinCmsPage;
  changed: boolean;
  warnings: string[];
  createdBlocks: ProductsMigrationReport["createdBlocks"];
  sources?: ProductsBlocksMigrationState["sources"];
} {
  const warnings: string[] = [];
  const createdBlocks: ProductsMigrationReport["createdBlocks"] = [];
  const infoId = productsMigrationBlockId(page.id, "products.info");
  if (layoutHasProductsPresentation(page, "productsAssortment")) {
    return { page, changed: false, warnings, createdBlocks };
  }
  // Only repair when Intro is present — missing Assortiment with Intro still on the
  // page is treated as corruption/incomplete migrate (duplicate-layout collapse).
  // Intentionally empty layouts are handled above by callers (layout.length === 0).
  // Deliberate Assortiment-only deletion while keeping Intro is not supported as a
  // sticky state: Secties can remove it again after restore.
  if (!layoutHasProductsPresentation(page, "productsIntro")) {
    return { page, changed: false, warnings, createdBlocks };
  }

  const ensured = ensureBuiltinSectionContent(page);
  const infoContent =
    (ensured["products.info"] as ProductsInfoContent | undefined) ??
    (defaultSectionContent("products.info") as ProductsInfoContent);
  const mapped = mapProductsInfoToFeatureGridData(infoContent);
  warnings.push(...mapped.warnings);
  const parsed = getBlockDataDefinition("featureGrid").schema.safeParse(mapped.data);
  if (!parsed.success) {
    warnings.push("products.info: could not restore Assortiment block");
    return { page, changed: false, warnings, createdBlocks };
  }

  const block: Block = {
    id: infoId,
    type: "featureGrid",
    data: parsed.data as Record<string, unknown>,
  };
  createdBlocks.push({ id: infoId, type: "featureGrid", source: "products.info" });
  warnings.push("products.info: restored Assortiment block after incomplete migration");

  const introIdx = page.layout.findIndex((item) => {
    if (item.kind !== "block") return false;
    const b = page.blocks.find((row) => row.id === item.blockId);
    return isProductsPresentationBlock(b, "productsIntro");
  });
  const layoutItem = {
    id: `block:${infoId}`,
    kind: "block" as const,
    blockId: infoId,
  };
  // Drop stale infoId refs (wrong type), then insert Assortiment after Intro.
  const layout = page.layout.filter(
    (item) => !(item.kind === "block" && item.blockId === infoId),
  );
  if (introIdx >= 0) {
    // Recompute intro index after filter (infoId refs removed).
    const nextIntroIdx = layout.findIndex((item) => {
      if (item.kind !== "block") return false;
      const b = page.blocks.find((row) => row.id === item.blockId);
      return isProductsPresentationBlock(b, "productsIntro");
    });
    layout.splice(nextIntroIdx >= 0 ? nextIntroIdx + 1 : layout.length, 0, layoutItem);
  } else {
    layout.push(layoutItem);
  }

  const prevSources = state.sources ?? ["products.main"];
  const sources = prevSources.includes("products.info")
    ? prevSources
    : ([...prevSources, "products.info"] as ProductsBlocksMigrationState["sources"]);

  return {
    page: {
      ...structuredClone(page),
      sectionContent: ensured,
      blocks: upsertBlock(
        page.blocks.filter((b) => b.id !== infoId),
        block,
      ),
      layout,
    },
    changed: true,
    warnings,
    createdBlocks,
    sources,
  };
}

function pickNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

/** Prefer picker-block copy when editors already customized a Producten presentation block. */
function mergeProductsIntroData(
  mapped: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!existing) return mapped;
  const existingMetrics = Array.isArray(existing.metrics) ? existing.metrics : null;
  return {
    ...mapped,
    title: pickNonEmptyString(existing.title, mapped.title) ?? mapped.title,
    body: pickNonEmptyString(existing.body, mapped.body) ?? mapped.body,
    notice: pickNonEmptyString(existing.notice, mapped.notice) ?? mapped.notice,
    eyebrow: pickNonEmptyString(existing.eyebrow, mapped.eyebrow) ?? mapped.eyebrow,
    image: existing.image ?? mapped.image,
    metrics:
      existingMetrics && existingMetrics.length > 0 ? existingMetrics : mapped.metrics,
    presentation: "productsIntro",
    reverse: false,
  };
}

function mergeProductsAssortmentData(
  mapped: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!existing) return mapped;
  const existingFeatures = Array.isArray(existing.features) ? existing.features : null;
  return {
    ...mapped,
    title: pickNonEmptyString(existing.title, mapped.title) ?? mapped.title,
    intro: pickNonEmptyString(existing.intro, mapped.intro) ?? mapped.intro,
    eyebrow: pickNonEmptyString(existing.eyebrow, mapped.eyebrow) ?? mapped.eyebrow,
    features:
      existingFeatures && existingFeatures.length > 0 ? existingFeatures : mapped.features,
    presentation: "productsAssortment",
  };
}

function isProductsPresentationBlock(
  block: Block | undefined,
  presentation: "productsIntro" | "productsAssortment",
): boolean {
  if (!block) return false;
  if (presentation === "productsIntro" && block.type !== "textImage") return false;
  if (presentation === "productsAssortment" && block.type !== "featureGrid") return false;
  return isRecord(block.data) && block.data.presentation === presentation;
}

function migrateProductFixedSlots(
  page: BuiltinCmsPage,
  _state: ProductsBlocksMigrationState,
  report: ProductsMigrationReport,
): ResolveProductsBlocksResult {
  let blocks = [...page.blocks];
  const nextLayout: LayoutItem[] = [];
  const migratedSources: ProductFixedKey[] = [];
  const mainId = productsMigrationBlockId(page.id, "products.main");
  const infoId = productsMigrationBlockId(page.id, "products.info");

  const existingIntro = blocks.find((b) => isProductsPresentationBlock(b, "productsIntro"));
  const existingAssortment = blocks.find((b) =>
    isProductsPresentationBlock(b, "productsAssortment"),
  );

  for (const item of page.layout) {
    if (item.kind === "block") {
      nextLayout.push(item);
      continue;
    }
    if (item.kind !== "fixed") {
      nextLayout.push(item);
      continue;
    }
    if (item.key !== "products.main" && item.key !== "products.info") {
      nextLayout.push(item);
      continue;
    }

    const fixedKey = item.key;
    const content = (page.sectionContent as Record<string, unknown> | undefined)?.[fixedKey];
    if (content !== undefined && content !== null && !isRecord(content)) {
      report.errors.push(`${fixedKey} malformed: expected object section content`);
      nextLayout.push(item);
      continue;
    }
    // Fall back to factory only when section content missing entirely.
    const effective =
      content ??
      (fixedKey === "products.main"
        ? defaultSectionContent("products.main")
        : defaultSectionContent("products.info"));

    if (fixedKey === "products.main") {
      const mapped = mapProductsMainToTextImageData(effective);
      const merged = mergeProductsIntroData(
        mapped.data,
        existingIntro && isRecord(existingIntro.data) ? existingIntro.data : undefined,
      );
      const parsed = getBlockDataDefinition("textImage").schema.safeParse(merged);
      if (!parsed.success) {
        report.errors.push(
          `products.main malformed: ${parsed.error.issues[0]?.message ?? "invalid payload"}`,
        );
        nextLayout.push(item);
        continue;
      }
      report.warnings.push(...mapped.warnings);
      if (existingIntro && existingIntro.id !== mainId) {
        report.warnings.push(
          "products.main: merged Productintro picker into migrated Intro (duplicate removed after resolve)",
        );
      }
      const block: Block = {
        id: mainId,
        type: "textImage" as BlockType,
        data: parsed.data as Record<string, unknown>,
      };
      blocks = upsertBlock(blocks, block);
      nextLayout.push(blockLayoutFromFixed(item, mainId));
      report.createdBlocks.push({ id: mainId, type: "textImage", source: "products.main" });
      migratedSources.push("products.main");
    } else {
      const mapped = mapProductsInfoToFeatureGridData(effective);
      const merged = mergeProductsAssortmentData(
        mapped.data,
        existingAssortment && isRecord(existingAssortment.data)
          ? existingAssortment.data
          : undefined,
      );
      const parsed = getBlockDataDefinition("featureGrid").schema.safeParse(merged);
      if (!parsed.success) {
        report.errors.push(
          `products.info malformed: ${parsed.error.issues[0]?.message ?? "invalid payload"}`,
        );
        nextLayout.push(item);
        continue;
      }
      report.warnings.push(...mapped.warnings);
      if (existingAssortment && existingAssortment.id !== infoId) {
        report.warnings.push(
          "products.info: merged Assortiment picker into migrated block (duplicate removed after resolve)",
        );
      }
      const block: Block = {
        id: infoId,
        type: "featureGrid" as BlockType,
        data: parsed.data as Record<string, unknown>,
      };
      blocks = upsertBlock(blocks, block);
      nextLayout.push(blockLayoutFromFixed(item, infoId));
      report.createdBlocks.push({ id: infoId, type: "featureGrid", source: "products.info" });
      migratedSources.push("products.info");
    }
  }

  // Nothing migrated (all slots errored) → leave page unchanged.
  if (migratedSources.length === 0) {
    return { page, report, changed: false };
  }

  // Both fixed and deterministic blocks already in layout? Prefer blocks already handled
  // by slot replace above (fixed removed from nextLayout).

  const remapped = remapProductsEnFieldDrafts({
    pageId: page.id,
    enFieldDrafts: page.enFieldDrafts ?? {},
    enFieldDraftSources: page.enFieldDraftSources ?? {},
    migratedSources,
  });
  report.localePathsRemapped = remapped.localePathsRemapped;

  // Diagnostic if somehow fixed keys remain alongside blocks (should not after replace)
  const stillFixed = nextLayout.some(
    (i) =>
      i.kind === "fixed" &&
      (i.key === "products.main" || i.key === "products.info"),
  );
  if (stillFixed && hasDeterministicProductsBlocks({ ...page, blocks })) {
    report.warnings.push(
      "products fixed and migrated blocks both present after resolve; blocks win on render",
    );
  }

  const migratedAt = new Date().toISOString();
  const next: BuiltinCmsPage = {
    ...structuredClone(page),
    blocks,
    layout: nextLayout,
    // Bump so normalize/reconcile does not re-insert products.main/info fixed slots.
    layoutVersion: Math.max(page.layoutVersion ?? 0, CURRENT_LAYOUT_VERSION),
    enFieldDrafts: remapped.enFieldDrafts,
    enFieldDraftSources: remapped.enFieldDraftSources,
    productsBlocksMigration: {
      version: PRODUCTS_BLOCKS_MIGRATION_VERSION,
      status: "migrated",
      migratedAt,
      sources: migratedSources,
    },
  };
  // Keep sectionContent as legacy backup
  report.toVersion = next.layoutVersion;
  return { page: next, report, changed: true };
}

function blockLayoutFromFixed(item: FixedLayoutItem, blockId: string): BlockLayoutItem {
  return {
    id: `block:${blockId}`,
    kind: "block",
    blockId,
    ...(item.hidden ? { hidden: true } : {}),
    ...(item.contentAlign ? { contentAlign: item.contentAlign } : {}),
  };
}

export function markProductsBlocksMigrationVerified(
  state: ProductsBlocksMigrationState,
): ProductsBlocksMigrationState {
  return { ...state, status: "verified", migratedAt: state.migratedAt ?? new Date().toISOString() };
}

/**
 * Older Producten migrations stored generic textImage/featureGrid without presentation.
 * Re-apply presentation (+ notice/eyebrow/intro from sectionContent when available).
 * Also seeds intro metrics when a productsIntro block is missing them.
 */
function ensureProductsPresentationOnMigratedBlocks(page: BuiltinCmsPage): {
  page: BuiltinCmsPage;
  changed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const mainId = productsMigrationBlockId(page.id, "products.main");
  const infoId = productsMigrationBlockId(page.id, "products.info");
  let changed = false;
  const blocks = page.blocks.map((block) => {
    if (block.type === "textImage") {
      const data = isRecord(block.data) ? block.data : {};
      if (data.presentation === "productsIntro") {
        const hasMetrics =
          Array.isArray(data.metrics) &&
          data.metrics.some(
            (row) =>
              row &&
              typeof row === "object" &&
              (typeof (row as { value?: unknown }).value === "string" ||
                typeof (row as { label?: unknown }).label === "string"),
          );
        if (hasMetrics) return block;
        const normalized = getBlockDataDefinition("textImage").normalize({
          ...data,
          presentation: "productsIntro",
        }) as Record<string, unknown>;
        changed = true;
        warnings.push("Seeded Producten intro metrics defaults");
        return { ...block, data: normalized };
      }
      if (block.id !== mainId) return block;
      const sc = (page.sectionContent as Record<string, unknown> | undefined)?.["products.main"];
      const mapped = mapProductsMainToTextImageData(sc ?? data);
      warnings.push(...mapped.warnings);
      // Prefer already-migrated title/body/image when sectionContent absent.
      const merged = {
        ...mapped.data,
        title: data.title ?? mapped.data.title,
        body:
          typeof data.body === "string" && data.presentation !== "productsIntro"
            ? // Legacy combined body — keep as intro paragraphs when notice missing
              (typeof mapped.data.notice === "string" ? mapped.data.body : data.body)
            : (mapped.data.body ?? data.body),
        image: data.image ?? mapped.data.image,
        notice: mapped.data.notice ?? data.notice,
        eyebrow: mapped.data.eyebrow ?? data.eyebrow,
        metrics: Array.isArray(data.metrics) ? data.metrics : mapped.data.metrics,
        presentation: "productsIntro",
        reverse: false,
      };
      const normalized = getBlockDataDefinition("textImage").normalize(merged) as Record<
        string,
        unknown
      >;
      changed = true;
      return { ...block, data: normalized };
    }
    if (block.id === infoId && block.type === "featureGrid") {
      const data = isRecord(block.data) ? block.data : {};
      if (data.presentation === "productsAssortment") {
        return block;
      }
      const sc = (page.sectionContent as Record<string, unknown> | undefined)?.["products.info"];
      const mapped = mapProductsInfoToFeatureGridData(sc ?? data);
      warnings.push(...mapped.warnings);
      const merged = {
        ...mapped.data,
        title: data.title ?? mapped.data.title,
        features: Array.isArray(data.features) ? data.features : mapped.data.features,
        presentation: "productsAssortment",
        eyebrow: mapped.data.eyebrow ?? data.eyebrow,
        intro: mapped.data.intro ?? data.intro,
      };
      const normalized = getBlockDataDefinition("featureGrid").normalize(merged) as Record<
        string,
        unknown
      >;
      changed = true;
      return { ...block, data: normalized };
    }
    return block;
  });

  if (!changed) return { page, changed: false, warnings };
  return {
    page: { ...structuredClone(page), blocks },
    changed: true,
    warnings: [
      ...warnings.filter((w) => w === "Seeded Producten intro metrics defaults"),
      "Upgraded Producten blocks to products presentation chrome",
    ],
  };
}
