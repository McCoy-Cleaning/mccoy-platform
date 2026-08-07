/**
 * Offerte fixed→reusable blocks migration (intro chrome + quote form).
 * Admin persists; storefront/admin preview resolve in memory via
 * {@link resolveOfferteBlocksLayout} / {@link resolveCmsPageForDisplay}.
 */

import { z } from "zod";
import type { BuiltinCmsPage, Block, BlockType } from "../types";
import type { LayoutItem, FixedLayoutItem, BlockLayoutItem } from "../layout";
import { CURRENT_LAYOUT_VERSION, type FixedSectionKey } from "../sections";
import { getBlockDataDefinition } from "../blocks/registry";
import {
  createDefaultQuoteRequestForm,
  normalizeQuoteRequestForm,
  type QuoteRequestFormBlockData,
} from "../blocks/new-sections";
import {
  defaultSectionContent,
  type ContactFormContent,
  type FormPageChromeContent,
} from "../content";
import { createMigrationBlockId } from "./block-id";

export const OFFERTE_BLOCKS_MIGRATION_VERSION = 1 as const;

export const offerteBlocksMigrationStatusSchema = z.enum([
  "not_started",
  "migrated",
  "verified",
]);

export type OfferteBlocksMigrationStatus = z.infer<
  typeof offerteBlocksMigrationStatusSchema
>;

export const offerteBlocksMigrationStateSchema = z.object({
  version: z.literal(OFFERTE_BLOCKS_MIGRATION_VERSION),
  status: offerteBlocksMigrationStatusSchema,
  migratedAt: z.string().optional(),
  sources: z
    .array(z.enum(["offerte.main", "offerte.form"]))
    .optional(),
});

export type OfferteBlocksMigrationState = z.infer<
  typeof offerteBlocksMigrationStateSchema
>;

export type OfferteMigrationReport = {
  pageId: string;
  fromVersion: number;
  toVersion: number;
  foundOfferteMain: boolean;
  foundOfferteForm: boolean;
  createdBlocks: Array<{
    id: string;
    type: BlockType;
    source: "offerte.main" | "offerte.form";
  }>;
  localePathsRemapped: number;
  warnings: string[];
  errors: string[];
};

export type ResolveOfferteBlocksResult = {
  page: BuiltinCmsPage;
  report: OfferteMigrationReport;
  changed: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function parseOfferteBlocksMigrationState(
  raw: unknown,
): OfferteBlocksMigrationState | null {
  const parsed = offerteBlocksMigrationStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function offerteMainMigrationBlockId(pageId: string): string {
  return createMigrationBlockId({
    pageId,
    fixedKey: "offerte.main",
    role: "primary",
  });
}

export function offerteFormMigrationBlockId(pageId: string): string {
  return createMigrationBlockId({
    pageId,
    fixedKey: "offerte.form",
    role: "primary",
  });
}

function emptyReport(page: BuiltinCmsPage): OfferteMigrationReport {
  return {
    pageId: page.id,
    fromVersion: page.layoutVersion,
    toVersion: page.layoutVersion,
    foundOfferteMain: false,
    foundOfferteForm: false,
    createdBlocks: [],
    localePathsRemapped: 0,
    warnings: [],
    errors: [],
  };
}

function layoutHasFixed(layout: LayoutItem[], key: FixedSectionKey): boolean {
  return layout.some((i) => i.kind === "fixed" && i.key === key);
}

function hasMainBlock(page: BuiltinCmsPage): boolean {
  const id = offerteMainMigrationBlockId(page.id);
  return page.blocks.some((b) => b.id === id && b.type === "hero");
}

function hasFormBlock(page: BuiltinCmsPage): boolean {
  const id = offerteFormMigrationBlockId(page.id);
  return page.blocks.some((b) => b.id === id && b.type === "quoteRequestForm");
}

/** Map fixed offerte.main → hero with formChrome presentation (exact intro design). */
export function mapOfferteMainToHeroBlockData(
  content: unknown,
): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const factory = defaultSectionContent("offerte.main") as FormPageChromeContent;
  const rec = isRecord(content) ? content : {};
  if (!isRecord(content)) {
    warnings.push("offerte.main: missing content; using factory defaults");
  }
  return {
    data: {
      presentation: "formChrome",
      eyebrow: (typeof rec.eyebrow === "string" && rec.eyebrow.trim()) || factory.eyebrow || "Offerte",
      title:
        (typeof rec.heading === "string" && rec.heading.trim()) ||
        (typeof rec.title === "string" && rec.title.trim()) ||
        factory.heading,
      subtitle:
        (typeof rec.body === "string" && rec.body.trim()) ||
        (typeof rec.subtitle === "string" && rec.subtitle.trim()) ||
        factory.body ||
        undefined,
      image: rec.image ?? factory.image,
      align: "left",
    },
    warnings,
  };
}

/** Map fixed offerte.form (+ scopes) → quoteRequestForm with tabs/fields. */
export function mapOfferteFormToQuoteRequestData(
  content: unknown,
): { data: QuoteRequestFormBlockData; warnings: string[] } {
  const warnings: string[] = [];
  const rec = isRecord(content) ? content : {};
  if (!isRecord(content)) {
    warnings.push("offerte.form: missing content; seeding default tabs/fields");
  }

  const base = createDefaultQuoteRequestForm();
  if (typeof rec.heading === "string" && rec.heading.trim()) {
    base.heading = rec.heading.trim();
  }
  if (typeof rec.description === "string" && rec.description.trim()) {
    base.description = rec.description.trim();
  } else if (typeof rec.body === "string" && rec.body.trim()) {
    base.description = rec.body.trim();
  }
  if (typeof rec.submitLabel === "string" && rec.submitLabel.trim()) {
    base.submitLabel = rec.submitLabel.trim();
    for (const tab of base.tabs) tab.submitLabel = rec.submitLabel.trim();
  }
  if (typeof rec.successMessage === "string" && rec.successMessage.trim()) {
    base.successMessage = rec.successMessage.trim();
    for (const tab of base.tabs) tab.successMessage = rec.successMessage.trim();
  }

  // Lift legacy per-scope snapshots onto tabs.
  const glass = isRecord(rec.glassScope) ? rec.glassScope : undefined;
  const furniture = isRecord(rec.furnitureScope) ? rec.furnitureScope : undefined;
  for (const tab of base.tabs) {
    if (tab.kind === "glass_washing" && glass) {
      tab.scope = glass as QuoteRequestFormBlockData["tabs"][number]["scope"];
    }
    if (tab.kind === "furniture_cleaning" && furniture) {
      tab.scope = furniture as QuoteRequestFormBlockData["tabs"][number]["scope"];
    }
  }

  // Preserve custom fields if already authored on the fixed section.
  if (Array.isArray(rec.fields) && rec.fields.length > 0 && base.tabs[0]) {
    // Legacy single-fields list applied to glass tab only when present.
    const normalized = normalizeQuoteRequestForm({
      ...base,
      tabs: base.tabs.map((tab, i) =>
        i === 0 ? { ...tab, fields: rec.fields } : tab,
      ),
    });
    return { data: normalized, warnings };
  }

  return { data: normalizeQuoteRequestForm(base), warnings };
}

export function remapOfferteEnFieldDrafts(input: {
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
  const mainId = offerteMainMigrationBlockId(input.pageId);
  const formId = offerteFormMigrationBlockId(input.pageId);

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

  move("section:offerte.main:eyebrow", `block:${mainId}:eyebrow`);
  move("section:offerte.main:heading", `block:${mainId}:title`);
  move("section:offerte.main:body", `block:${mainId}:subtitle`);
  move("section:offerte.form:heading", `block:${formId}:heading`);
  move("section:offerte.form:body", `block:${formId}:description`);
  move("section:offerte.form:submitLabel", `block:${formId}:submitLabel`);
  move("section:offerte.form:successMessage", `block:${formId}:successMessage`);

  return { enFieldDrafts: drafts, enFieldDraftSources: sources, localePathsRemapped };
}

export function shouldServeOfferteMigratedBlocks(page: BuiltinCmsPage): boolean {
  const state = parseOfferteBlocksMigrationState(page.offerteBlocksMigration);
  if (!state) return false;
  if (state.status !== "migrated" && state.status !== "verified") return false;
  // Suppress fixed keys that have migrated counterparts.
  return hasMainBlock(page) || hasFormBlock(page);
}

export function suppressedOfferteFixedKeys(page: BuiltinCmsPage): Set<FixedSectionKey> {
  const out = new Set<FixedSectionKey>();
  if (page.pageKey !== "offerte") return out;

  const state = parseOfferteBlocksMigrationState(page.offerteBlocksMigration);
  const migrated =
    state?.status === "migrated" || state?.status === "verified";

  const blockIds = new Set(
    page.layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
  );
  const mainId = offerteMainMigrationBlockId(page.id);
  const formId = offerteFormMigrationBlockId(page.id);

  if (
    (migrated && hasMainBlock(page)) ||
    (layoutHasFixed(page.layout, "offerte.main") && blockIds.has(mainId))
  ) {
    out.add("offerte.main");
  }
  if (
    (migrated && hasFormBlock(page)) ||
    (layoutHasFixed(page.layout, "offerte.form") && blockIds.has(formId)) ||
    page.blocks.some((b) => b.type === "quoteRequestForm" && blockIds.has(b.id))
  ) {
    out.add("offerte.form");
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

export function resolveOfferteBlocksLayout(
  page: BuiltinCmsPage,
): ResolveOfferteBlocksResult {
  const report = emptyReport(page);

  if (page.pageKey !== "offerte") {
    return { page, report, changed: false };
  }

  const state =
    parseOfferteBlocksMigrationState(page.offerteBlocksMigration) ??
    ({
      version: OFFERTE_BLOCKS_MIGRATION_VERSION,
      status: "not_started",
    } satisfies OfferteBlocksMigrationState);

  if (state.status === "migrated" || state.status === "verified") {
    report.foundOfferteMain = hasMainBlock(page);
    report.foundOfferteForm = hasFormBlock(page);
    let layout = page.layout;
    let changed = false;
    if (layoutHasFixed(layout, "offerte.main") && hasMainBlock(page)) {
      layout = layout.filter((i) => !(i.kind === "fixed" && i.key === "offerte.main"));
      changed = true;
    }
    if (layoutHasFixed(layout, "offerte.form") && hasFormBlock(page)) {
      layout = layout.filter((i) => !(i.kind === "fixed" && i.key === "offerte.form"));
      changed = true;
    }
    if (changed) {
      return { page: { ...structuredClone(page), layout }, report, changed: true };
    }
    return { page, report, changed: false };
  }

  const foundMain = layoutHasFixed(page.layout, "offerte.main");
  const foundForm = layoutHasFixed(page.layout, "offerte.form");
  report.foundOfferteMain = foundMain;
  report.foundOfferteForm = foundForm;

  if (!foundMain && !foundForm) {
    if (hasMainBlock(page) || hasFormBlock(page)) {
      const sources: Array<"offerte.main" | "offerte.form"> = [];
      if (hasMainBlock(page)) sources.push("offerte.main");
      if (hasFormBlock(page)) sources.push("offerte.form");
      return {
        page: {
          ...structuredClone(page),
          offerteBlocksMigration: {
            version: OFFERTE_BLOCKS_MIGRATION_VERSION,
            status: "migrated",
            migratedAt: new Date().toISOString(),
            sources,
          },
        },
        report,
        changed: true,
      };
    }
    return { page, report, changed: false };
  }

  let blocks = page.blocks.slice();
  const nextLayout: LayoutItem[] = [];
  const sources: Array<"offerte.main" | "offerte.form"> = [];

  for (const item of page.layout) {
    if (item.kind === "fixed" && item.key === "offerte.main") {
      const content = page.sectionContent?.["offerte.main"];
      if (content !== undefined && content !== null && !isRecord(content)) {
        report.errors.push("offerte.main malformed: expected object");
        return { page, report, changed: false };
      }
      const mapped = mapOfferteMainToHeroBlockData(
        content ?? defaultSectionContent("offerte.main"),
      );
      report.warnings.push(...mapped.warnings);
      const def = getBlockDataDefinition("hero");
      const parsed = def.schema.safeParse(def.normalize(mapped.data));
      if (!parsed.success) {
        report.errors.push(
          `offerte.main malformed: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
        return { page, report, changed: false };
      }
      const id = offerteMainMigrationBlockId(page.id);
      blocks = upsertBlock(blocks, {
        id,
        type: "hero",
        data: parsed.data as Record<string, unknown>,
        dataVersion: def.dataVersion,
      });
      nextLayout.push(blockLayoutFromFixed(item, id));
      report.createdBlocks.push({ id, type: "hero", source: "offerte.main" });
      sources.push("offerte.main");
      continue;
    }

    if (item.kind === "fixed" && item.key === "offerte.form") {
      const content = page.sectionContent?.["offerte.form"] as ContactFormContent | undefined;
      const mapped = mapOfferteFormToQuoteRequestData(content ?? {});
      report.warnings.push(...mapped.warnings);
      const def = getBlockDataDefinition("quoteRequestForm");
      const parsed = def.schema.safeParse(mapped.data);
      if (!parsed.success) {
        report.errors.push(
          `offerte.form malformed: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
        return { page, report, changed: false };
      }
      const id = offerteFormMigrationBlockId(page.id);
      blocks = upsertBlock(blocks, {
        id,
        type: "quoteRequestForm",
        data: parsed.data as Record<string, unknown>,
        dataVersion: def.dataVersion,
      });
      nextLayout.push(blockLayoutFromFixed(item, id));
      report.createdBlocks.push({
        id,
        type: "quoteRequestForm",
        source: "offerte.form",
      });
      sources.push("offerte.form");
      continue;
    }

    nextLayout.push(item);
  }

  const remapped = remapOfferteEnFieldDrafts({
    pageId: page.id,
    enFieldDrafts: page.enFieldDrafts ?? {},
    enFieldDraftSources: page.enFieldDraftSources ?? {},
  });
  report.localePathsRemapped = remapped.localePathsRemapped;

  const next: BuiltinCmsPage = {
    ...structuredClone(page),
    blocks,
    layout: nextLayout,
    layoutVersion: Math.max(page.layoutVersion ?? 0, CURRENT_LAYOUT_VERSION),
    enFieldDrafts: remapped.enFieldDrafts,
    enFieldDraftSources: remapped.enFieldDraftSources,
    offerteBlocksMigration: {
      version: OFFERTE_BLOCKS_MIGRATION_VERSION,
      status: "migrated",
      migratedAt: new Date().toISOString(),
      sources,
    },
  };
  report.toVersion = next.layoutVersion;
  return { page: next, report, changed: true };
}

export function markOfferteBlocksMigrationVerified(
  page: BuiltinCmsPage,
): BuiltinCmsPage {
  const state = parseOfferteBlocksMigrationState(page.offerteBlocksMigration);
  if (!state || state.status === "not_started") return page;
  return {
    ...page,
    offerteBlocksMigration: {
      ...state,
      status: "verified",
    },
  };
}
