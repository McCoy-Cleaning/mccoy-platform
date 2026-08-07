/**
 * About (Over ons) fixed→reusable blocks migration.
 * Admin persists; storefront/admin preview resolve in memory via
 * {@link resolveAboutBlocksLayout} / {@link resolveCmsPageForDisplay}.
 *
 * Roles: intro (centered/aboutIntro) + mission/vision/history (textImage/aboutPillar).
 */

import { z } from "zod";
import type { BuiltinCmsPage, Block, BlockType } from "../types";
import type { LayoutItem, FixedLayoutItem, BlockLayoutItem } from "../layout";
import { CURRENT_LAYOUT_VERSION, type FixedSectionKey } from "../sections";
import { getBlockDataDefinition } from "../blocks/registry";
import {
  defaultSectionContent,
  type AboutMainContent,
} from "../content";
import { createMigrationBlockId } from "./block-id";

export const ABOUT_BLOCKS_MIGRATION_VERSION = 1 as const;

export const aboutBlocksMigrationStatusSchema = z.enum([
  "not_started",
  "migrated",
  "verified",
]);

export type AboutBlocksMigrationStatus = z.infer<typeof aboutBlocksMigrationStatusSchema>;

export const aboutBlocksMigrationStateSchema = z.object({
  version: z.literal(ABOUT_BLOCKS_MIGRATION_VERSION),
  status: aboutBlocksMigrationStatusSchema,
  migratedAt: z.string().optional(),
  sources: z.array(z.literal("about.main")).optional(),
});

export type AboutBlocksMigrationState = z.infer<typeof aboutBlocksMigrationStateSchema>;

export type AboutMigrationReport = {
  pageId: string;
  fromVersion: number;
  toVersion: number;
  foundAboutMain: boolean;
  createdBlocks: Array<{ id: string; type: BlockType; source: "about.main"; role: string }>;
  localePathsRemapped: number;
  warnings: string[];
  errors: string[];
};

export type ResolveAboutBlocksResult = {
  page: BuiltinCmsPage;
  report: AboutMigrationReport;
  changed: boolean;
};

const ABOUT_ROLES = ["intro", "mission", "vision", "history"] as const;
type AboutRole = (typeof ABOUT_ROLES)[number];

/** Exact NL pillar tiles from the live Over ons header. */
export const DEFAULT_ABOUT_INTRO_PILLARS_NL = [
  { id: "about_pillar_quality", icon: "award", label: "Premium kwaliteit" },
  { id: "about_pillar_team", icon: "shield", label: "Betrouwbaar team" },
  { id: "about_pillar_contact", icon: "users", label: "Persoonlijk contact" },
  { id: "about_pillar_sustain", icon: "leaf", label: "Duurzame middelen" },
] as const;

export const DEFAULT_ABOUT_INTRO_PILLARS_EN = [
  { id: "about_pillar_quality", icon: "award", label: "Premium quality" },
  { id: "about_pillar_team", icon: "shield", label: "Reliable team" },
  { id: "about_pillar_contact", icon: "users", label: "Personal contact" },
  { id: "about_pillar_sustain", icon: "leaf", label: "Sustainable products" },
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function parseAboutBlocksMigrationState(
  raw: unknown,
): AboutBlocksMigrationState | null {
  const parsed = aboutBlocksMigrationStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function aboutMigrationBlockId(pageId: string, role: AboutRole): string {
  return createMigrationBlockId({
    pageId,
    fixedKey: "about.main",
    role,
  });
}

function emptyReport(page: BuiltinCmsPage): AboutMigrationReport {
  return {
    pageId: page.id,
    fromVersion: page.layoutVersion,
    toVersion: page.layoutVersion,
    foundAboutMain: false,
    createdBlocks: [],
    localePathsRemapped: 0,
    warnings: [],
    errors: [],
  };
}

function layoutHasAboutMainFixed(layout: LayoutItem[]): boolean {
  return layout.some((i) => i.kind === "fixed" && i.key === "about.main");
}

function hasDeterministicAboutBlocks(page: BuiltinCmsPage): boolean {
  return ABOUT_ROLES.every((role) => {
    const id = aboutMigrationBlockId(page.id, role);
    const expectedType = role === "intro" ? "centered" : "textImage";
    return page.blocks.some((b) => b.id === id && b.type === expectedType);
  });
}

export function mapAboutIntroToCenteredData(
  content: unknown,
): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const factory = defaultSectionContent("about.main") as AboutMainContent;
  const rec = isRecord(content) ? content : {};
  if (!isRecord(content)) {
    warnings.push("about.main: missing content; using factory defaults for intro");
  }
  return {
    data: {
      presentation: "aboutIntro",
      eyebrow: (typeof rec.eyebrow === "string" && rec.eyebrow.trim()) || factory.eyebrow || "Over ons",
      title:
        (typeof rec.heading === "string" && rec.heading.trim()) ||
        (typeof rec.title === "string" && rec.title.trim()) ||
        factory.heading,
      pillars: DEFAULT_ABOUT_INTRO_PILLARS_NL.map((p) => ({ ...p })),
    },
    warnings,
  };
}

export function mapAboutPillarToTextImageData(
  content: unknown,
  role: "mission" | "vision" | "history",
  index: number,
): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const factory = defaultSectionContent("about.main") as AboutMainContent;
  const rec = isRecord(content) ? content : {};
  if (!isRecord(content)) {
    warnings.push(`about.main: missing content; using factory defaults for ${role}`);
  }

  const titleKey = `${role}Title` as const;
  const bodyKey = `${role}Body` as const;
  const imageKey = `${role}Image` as const;

  const title =
    (typeof rec[titleKey] === "string" && (rec[titleKey] as string).trim()) ||
    (factory[titleKey] as string | undefined) ||
    (role === "mission" ? "Missie" : role === "vision" ? "Visie" : "Historie");
  const body =
    (typeof rec[bodyKey] === "string" && (rec[bodyKey] as string).trim()) ||
    (factory[bodyKey] as string | undefined) ||
    undefined;

  let image = rec[imageKey] ?? (role === "mission" ? rec.image : undefined) ?? factory[imageKey];
  if (role === "mission" && !image) image = factory.image ?? factory.missionImage;

  const tags = { mission: "01", vision: "02", history: "03" } as const;
  const icons = { mission: "target", vision: "eye", history: "history" } as const;

  return {
    data: {
      presentation: "aboutPillar",
      title,
      body,
      image,
      reverse: index % 2 === 1,
      tag: tags[role],
      icon: icons[role],
      ...(role === "mission"
        ? { aspectClassName: "aspect-[16/9]", scaleMode: "soft" as const }
        : {}),
      ...(role === "history" ? { objectPosition: "center 20%" } : {}),
    },
    warnings,
  };
}

export function remapAboutEnFieldDrafts(input: {
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
  const introId = aboutMigrationBlockId(input.pageId, "intro");
  const missionId = aboutMigrationBlockId(input.pageId, "mission");
  const visionId = aboutMigrationBlockId(input.pageId, "vision");
  const historyId = aboutMigrationBlockId(input.pageId, "history");

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

  move("section:about.main:eyebrow", `block:${introId}:eyebrow`);
  move("section:about.main:heading", `block:${introId}:title`);
  move("section:about.main:missionTitle", `block:${missionId}:title`);
  move("section:about.main:missionBody", `block:${missionId}:body`);
  move("section:about.main:visionTitle", `block:${visionId}:title`);
  move("section:about.main:visionBody", `block:${visionId}:body`);
  move("section:about.main:historyTitle", `block:${historyId}:title`);
  move("section:about.main:historyBody", `block:${historyId}:body`);

  return { enFieldDrafts: drafts, enFieldDraftSources: sources, localePathsRemapped };
}

export function shouldServeAboutMigratedBlocks(page: BuiltinCmsPage): boolean {
  const state = parseAboutBlocksMigrationState(page.aboutBlocksMigration);
  if (!state) return false;
  if (state.status !== "migrated" && state.status !== "verified") return false;
  return hasDeterministicAboutBlocks(page);
}

export function suppressedAboutFixedKeys(page: BuiltinCmsPage): Set<FixedSectionKey> {
  const out = new Set<FixedSectionKey>();
  if (page.pageKey !== "about") return out;

  if (shouldServeAboutMigratedBlocks(page)) {
    out.add("about.main");
    return out;
  }

  const introId = aboutMigrationBlockId(page.id, "intro");
  const blockIds = new Set(
    page.layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
  );
  if (layoutHasAboutMainFixed(page.layout) && blockIds.has(introId)) {
    out.add("about.main");
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
 * Canonical About resolver. Does not persist.
 * Replaces fixed `about.main` with deterministic reusable blocks.
 */
export function resolveAboutBlocksLayout(page: BuiltinCmsPage): ResolveAboutBlocksResult {
  const report = emptyReport(page);

  if (page.pageKey !== "about") {
    return { page, report, changed: false };
  }

  const state =
    parseAboutBlocksMigrationState(page.aboutBlocksMigration) ??
    ({
      version: ABOUT_BLOCKS_MIGRATION_VERSION,
      status: "not_started",
    } satisfies AboutBlocksMigrationState);

  if (state.status === "migrated" || state.status === "verified") {
    report.foundAboutMain = hasDeterministicAboutBlocks(page);
    if (layoutHasAboutMainFixed(page.layout) && hasDeterministicAboutBlocks(page)) {
      const next: BuiltinCmsPage = {
        ...structuredClone(page),
        layout: page.layout.filter((i) => !(i.kind === "fixed" && i.key === "about.main")),
      };
      return { page: next, report, changed: true };
    }
    return { page, report, changed: false };
  }

  const foundFixed = layoutHasAboutMainFixed(page.layout);
  report.foundAboutMain = foundFixed;

  if (!foundFixed) {
    if (hasDeterministicAboutBlocks(page)) {
      const migratedAt = new Date().toISOString();
      return {
        page: {
          ...structuredClone(page),
          aboutBlocksMigration: {
            version: ABOUT_BLOCKS_MIGRATION_VERSION,
            status: "migrated",
            migratedAt,
            sources: ["about.main"],
          },
        },
        report,
        changed: true,
      };
    }
    return { page, report, changed: false };
  }

  const content = page.sectionContent?.["about.main"];
  if (content !== undefined && content !== null && !isRecord(content)) {
    report.errors.push("about.main malformed: expected object section content");
    return { page, report, changed: false };
  }

  const effective = content ?? defaultSectionContent("about.main");
  let blocks = page.blocks.slice();
  const nextLayout: LayoutItem[] = [];

  for (const item of page.layout) {
    if (!(item.kind === "fixed" && item.key === "about.main")) {
      nextLayout.push(item);
      continue;
    }

    const roleSpecs: Array<{
      role: AboutRole;
      type: BlockType;
      mapped: { data: Record<string, unknown>; warnings: string[] };
    }> = [
      {
        role: "intro",
        type: "centered",
        mapped: mapAboutIntroToCenteredData(effective),
      },
      {
        role: "mission",
        type: "textImage",
        mapped: mapAboutPillarToTextImageData(effective, "mission", 0),
      },
      {
        role: "vision",
        type: "textImage",
        mapped: mapAboutPillarToTextImageData(effective, "vision", 1),
      },
      {
        role: "history",
        type: "textImage",
        mapped: mapAboutPillarToTextImageData(effective, "history", 2),
      },
    ];

    for (const spec of roleSpecs) {
      report.warnings.push(...spec.mapped.warnings);
      const def = getBlockDataDefinition(spec.type);
      const parsed = def.schema.safeParse(def.normalize(spec.mapped.data));
      if (!parsed.success) {
        report.errors.push(
          `about.main/${spec.role} malformed: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
        return { page, report, changed: false };
      }
      const id = aboutMigrationBlockId(page.id, spec.role);
      const block: Block = {
        id,
        type: spec.type,
        data: parsed.data as Record<string, unknown>,
        dataVersion: def.dataVersion,
      };
      blocks = upsertBlock(blocks, block);
      nextLayout.push(blockLayoutFromFixed(item, id));
      report.createdBlocks.push({
        id,
        type: spec.type,
        source: "about.main",
        role: spec.role,
      });
    }
  }

  const remapped = remapAboutEnFieldDrafts({
    pageId: page.id,
    enFieldDrafts: page.enFieldDrafts ?? {},
    enFieldDraftSources: page.enFieldDraftSources ?? {},
  });
  report.localePathsRemapped = remapped.localePathsRemapped;

  const migratedAt = new Date().toISOString();
  const next: BuiltinCmsPage = {
    ...structuredClone(page),
    blocks,
    layout: nextLayout,
    layoutVersion: Math.max(page.layoutVersion ?? 0, CURRENT_LAYOUT_VERSION),
    enFieldDrafts: remapped.enFieldDrafts,
    enFieldDraftSources: remapped.enFieldDraftSources,
    aboutBlocksMigration: {
      version: ABOUT_BLOCKS_MIGRATION_VERSION,
      status: "migrated",
      migratedAt,
      sources: ["about.main"],
    },
  };
  report.toVersion = next.layoutVersion;
  return { page: next, report, changed: true };
}

export function markAboutBlocksMigrationVerified(page: BuiltinCmsPage): BuiltinCmsPage {
  const state = parseAboutBlocksMigrationState(page.aboutBlocksMigration);
  if (!state || state.status === "not_started") return page;
  return {
    ...page,
    aboutBlocksMigration: {
      ...state,
      status: "verified",
    },
  };
}
