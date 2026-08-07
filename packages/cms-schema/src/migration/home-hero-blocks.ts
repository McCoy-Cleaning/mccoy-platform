/**
 * Home hero fixed→reusable `hero` block migration.
 * Admin persists; storefront/admin preview resolve in memory via
 * {@link resolveHomeHeroBlocksLayout} / {@link resolveCmsPageForDisplay}.
 */

import { z } from "zod";
import type { BuiltinCmsPage, Block, BlockType } from "../types";
import type { LayoutItem, FixedLayoutItem, BlockLayoutItem } from "../layout";
import { CURRENT_LAYOUT_VERSION, type FixedSectionKey } from "../sections";
import { getBlockDataDefinition } from "../blocks/registry";
import {
  DEFAULT_HERO_TRUST_ITEMS,
  type HeroBlockData,
  type HeroTrustItem,
} from "../blocks/catalog";
import { defaultSectionContent, type HomeHeroContent, type StatsContent } from "../content";
import { createMigrationBlockId } from "./block-id";

export const HOME_HERO_BLOCKS_MIGRATION_VERSION = 1 as const;

export const homeHeroBlocksMigrationStatusSchema = z.enum([
  "not_started",
  "migrated",
  "verified",
]);

export type HomeHeroBlocksMigrationStatus = z.infer<
  typeof homeHeroBlocksMigrationStatusSchema
>;

export const homeHeroBlocksMigrationStateSchema = z.object({
  version: z.literal(HOME_HERO_BLOCKS_MIGRATION_VERSION),
  status: homeHeroBlocksMigrationStatusSchema,
  migratedAt: z.string().optional(),
  sources: z.array(z.literal("home.hero")).optional(),
});

export type HomeHeroBlocksMigrationState = z.infer<
  typeof homeHeroBlocksMigrationStateSchema
>;

export type HomeHeroMigrationReport = {
  pageId: string;
  fromVersion: number;
  toVersion: number;
  foundHomeHero: boolean;
  createdBlocks: Array<{ id: string; type: "hero"; source: "home.hero" }>;
  localePathsRemapped: number;
  warnings: string[];
  errors: string[];
};

export type ResolveHomeHeroBlocksResult = {
  page: BuiltinCmsPage;
  report: HomeHeroMigrationReport;
  changed: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function parseHomeHeroBlocksMigrationState(
  raw: unknown,
): HomeHeroBlocksMigrationState | null {
  const parsed = homeHeroBlocksMigrationStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function homeHeroMigrationBlockId(pageId: string): string {
  return createMigrationBlockId({
    pageId,
    fixedKey: "home.hero",
    role: "primary",
  });
}

function emptyReport(page: BuiltinCmsPage): HomeHeroMigrationReport {
  return {
    pageId: page.id,
    fromVersion: page.layoutVersion,
    toVersion: page.layoutVersion,
    foundHomeHero: false,
    createdBlocks: [],
    localePathsRemapped: 0,
    warnings: [],
    errors: [],
  };
}

function layoutHasHomeHeroFixed(layout: LayoutItem[]): boolean {
  return layout.some((i) => i.kind === "fixed" && i.key === "home.hero");
}

function hasDeterministicHomeHeroBlock(page: BuiltinCmsPage): boolean {
  const id = homeHeroMigrationBlockId(page.id);
  return page.blocks.some((b) => b.id === id && b.type === "hero");
}

function defaultTrustFromStats(page: BuiltinCmsPage): HeroTrustItem[] {
  const stats = page.sectionContent?.["home.stats"] as StatsContent | undefined;
  if (stats?.items?.length) {
    return stats.items.map((item) => ({
      id: item.id,
      value: item.value,
      label: item.label,
    }));
  }
  const factory = defaultSectionContent("home.stats") as StatsContent;
  return factory.items.map((item) => ({
    id: item.id,
    value: item.value,
    label: item.label,
  }));
}

/** Map legacy fixed `home.hero` (+ optional stats) into reusable hero block data. */
export function mapHomeHeroToHeroBlockData(
  content: unknown,
  trustItems?: HeroTrustItem[],
): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const rec = isRecord(content) ? content : {};
  const factory = defaultSectionContent("home.hero") as HomeHeroContent;
  const heading =
    (typeof rec.heading === "string" && rec.heading.trim()) ||
    (typeof rec.title === "string" && rec.title.trim()) ||
    factory.heading;
  if (!isRecord(content)) {
    warnings.push("home.hero: missing content; using factory defaults");
  }

  const accentRaw = rec.headingAccent ?? factory.headingAccent;
  const accent =
    typeof accentRaw === "string"
      ? { accent: accentRaw.replace(/<[^>]+>/g, "").trim() || undefined }
      : isRecord(accentRaw)
        ? accentRaw
        : undefined;

  const trust =
    trustItems && trustItems.length
      ? trustItems
      : DEFAULT_HERO_TRUST_ITEMS.map((item) => ({ ...item }));
  const first = trust[0];

  const seed: Record<string, unknown> = {
    eyebrow: rec.eyebrow ?? factory.eyebrow,
    title: heading,
    subtitle: rec.body ?? rec.subtitle ?? factory.body,
    headingAccent: accent,
    cta: rec.primaryCta ?? rec.cta,
    secondaryCta: rec.secondaryCta ?? factory.secondaryCta,
    image: rec.image ?? factory.image,
    align: "left",
    trustItems: trust,
    highlightStat: first
      ? { value: first.value, label: first.label }
      : { value: "25+", label: "Jaar ervaring" },
    certBadge: typeof rec.certBadge === "string" ? rec.certBadge : "Gecertificeerd",
  };

  const def = getBlockDataDefinition("hero");
  return { data: def.normalize(seed) as Record<string, unknown>, warnings };
}

export function remapHomeHeroEnFieldDrafts(input: {
  pageId: string;
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
}): {
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
  localePathsRemapped: number;
} {
  const drafts = { ...input.enFieldDrafts };
  const sources = { ...input.enFieldDraftSources };
  let localePathsRemapped = 0;
  const id = homeHeroMigrationBlockId(input.pageId);

  const move = (from: string, to: string) => {
    if (!(from in drafts)) return;
    if (!(to in drafts)) {
      drafts[to] = drafts[from]!;
      if (from in sources) sources[to] = sources[from]!;
      localePathsRemapped += 1;
    }
    delete drafts[from];
    delete sources[from];
  };

  move("section:home.hero:eyebrow", `block:${id}:eyebrow`);
  move("section:home.hero:heading", `block:${id}:title`);
  move("section:home.hero:headingAccent", `block:${id}:headingAccent.accent`);
  move("section:home.hero:body", `block:${id}:subtitle`);
  move("section:home.hero:primaryCta.label", `block:${id}:cta.label`);
  move("section:home.hero:secondaryCta.label", `block:${id}:secondaryCta.label`);
  move("section:home.hero:image.alt", `block:${id}:image.alt`);

  return { enFieldDrafts: drafts, enFieldDraftSources: sources, localePathsRemapped };
}

/**
 * Whether storefront/admin should suppress fixed `home.hero` (blocks win).
 */
export function shouldServeHomeHeroMigratedBlock(page: BuiltinCmsPage): boolean {
  const state = parseHomeHeroBlocksMigrationState(page.homeHeroBlocksMigration);
  if (!state) return false;
  if (state.status !== "migrated" && state.status !== "verified") return false;
  return hasDeterministicHomeHeroBlock(page);
}

export function suppressedHomeHeroFixedKeys(page: BuiltinCmsPage): Set<FixedSectionKey> {
  const out = new Set<FixedSectionKey>();
  if (page.pageKey !== "home") return out;

  if (shouldServeHomeHeroMigratedBlock(page)) {
    out.add("home.hero");
    return out;
  }

  const heroId = homeHeroMigrationBlockId(page.id);
  const blockIds = new Set(
    page.layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
  );
  if (layoutHasHomeHeroFixed(page.layout) && blockIds.has(heroId)) {
    out.add("home.hero");
  } else if (
    layoutHasHomeHeroFixed(page.layout) &&
    page.blocks.some((b) => b.type === "hero" && blockIds.has(b.id))
  ) {
    // Any in-layout hero on Home replaces the fixed slot visually.
    out.add("home.hero");
  }
  return out;
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

function upsertBlock(blocks: Block[], block: Block): Block[] {
  const idx = blocks.findIndex((b) => b.id === block.id);
  if (idx < 0) return [...blocks, block];
  const next = blocks.slice();
  next[idx] = block;
  return next;
}

/**
 * Canonical Home hero resolver. Does not persist.
 * Replaces fixed `home.hero` with a deterministic reusable `hero` block.
 */
export function resolveHomeHeroBlocksLayout(
  page: BuiltinCmsPage,
): ResolveHomeHeroBlocksResult {
  const report = emptyReport(page);

  if (page.pageKey !== "home") {
    return { page, report, changed: false };
  }

  const state =
    parseHomeHeroBlocksMigrationState(page.homeHeroBlocksMigration) ??
    ({
      version: HOME_HERO_BLOCKS_MIGRATION_VERSION,
      status: "not_started",
    } satisfies HomeHeroBlocksMigrationState);

  if (state.status === "migrated" || state.status === "verified") {
    if (page.layout.length === 0) {
      report.warnings.push("Home layout empty after hero migration; not reseeding");
    }
    report.foundHomeHero = hasDeterministicHomeHeroBlock(page);
    // Drop leftover fixed home.hero if migration already stamped.
    if (layoutHasHomeHeroFixed(page.layout) && hasDeterministicHomeHeroBlock(page)) {
      const next: BuiltinCmsPage = {
        ...structuredClone(page),
        layout: page.layout.filter(
          (i) => !(i.kind === "fixed" && i.key === "home.hero"),
        ),
      };
      return { page: next, report, changed: true };
    }
    return { page, report, changed: false };
  }

  const foundFixed = layoutHasHomeHeroFixed(page.layout);
  report.foundHomeHero = foundFixed;

  if (!foundFixed) {
    if (hasDeterministicHomeHeroBlock(page)) {
      const migratedAt = new Date().toISOString();
      return {
        page: {
          ...structuredClone(page),
          homeHeroBlocksMigration: {
            version: HOME_HERO_BLOCKS_MIGRATION_VERSION,
            status: "migrated",
            migratedAt,
            sources: ["home.hero"],
          },
        },
        report,
        changed: true,
      };
    }
    return { page, report, changed: false };
  }

  const heroId = homeHeroMigrationBlockId(page.id);
  const content = page.sectionContent?.["home.hero"];
  if (content !== undefined && content !== null && !isRecord(content)) {
    report.errors.push("home.hero malformed: expected object section content");
    return { page, report, changed: false };
  }

  const effective = content ?? defaultSectionContent("home.hero");
  const mapped = mapHomeHeroToHeroBlockData(effective, defaultTrustFromStats(page));
  report.warnings.push(...mapped.warnings);

  const def = getBlockDataDefinition("hero");
  const parsed = def.schema.safeParse(mapped.data);
  if (!parsed.success) {
    report.errors.push(
      `home.hero malformed: ${parsed.error.issues[0]?.message ?? "invalid payload"}`,
    );
    return { page, report, changed: false };
  }

  const block: Block = {
    id: heroId,
    type: "hero" as BlockType,
    data: parsed.data as Record<string, unknown>,
    dataVersion: def.dataVersion,
  };

  let blocks = upsertBlock(page.blocks, block);
  const nextLayout: LayoutItem[] = [];
  for (const item of page.layout) {
    if (item.kind === "fixed" && item.key === "home.hero") {
      nextLayout.push(blockLayoutFromFixed(item, heroId));
      continue;
    }
    nextLayout.push(item);
  }

  const remapped = remapHomeHeroEnFieldDrafts({
    pageId: page.id,
    enFieldDrafts: page.enFieldDrafts ?? {},
    enFieldDraftSources: page.enFieldDraftSources ?? {},
  });
  report.localePathsRemapped = remapped.localePathsRemapped;
  report.createdBlocks.push({ id: heroId, type: "hero", source: "home.hero" });

  const migratedAt = new Date().toISOString();
  const next: BuiltinCmsPage = {
    ...structuredClone(page),
    blocks,
    layout: nextLayout,
    layoutVersion: Math.max(page.layoutVersion ?? 0, CURRENT_LAYOUT_VERSION),
    enFieldDrafts: remapped.enFieldDrafts,
    enFieldDraftSources: remapped.enFieldDraftSources,
    homeHeroBlocksMigration: {
      version: HOME_HERO_BLOCKS_MIGRATION_VERSION,
      status: "migrated",
      migratedAt,
      sources: ["home.hero"],
    },
  };
  report.toVersion = next.layoutVersion;
  return { page: next, report, changed: true };
}

export function markHomeHeroBlocksMigrationVerified(
  page: BuiltinCmsPage,
): BuiltinCmsPage {
  const state = parseHomeHeroBlocksMigrationState(page.homeHeroBlocksMigration);
  if (!state || state.status === "not_started") return page;
  return {
    ...page,
    homeHeroBlocksMigration: {
      ...state,
      status: "verified",
    },
  };
}

/** Seed hero block data from legacy HomeHeroContent (layout-ops / catalog add). */
export function seedHeroBlockFromHomeHeroContent(
  content: HomeHeroContent | undefined,
  trustItems?: HeroTrustItem[],
): HeroBlockData {
  const mapped = mapHomeHeroToHeroBlockData(
    content ?? defaultSectionContent("home.hero"),
    trustItems,
  );
  return getBlockDataDefinition("hero").normalize(mapped.data) as HeroBlockData;
}
