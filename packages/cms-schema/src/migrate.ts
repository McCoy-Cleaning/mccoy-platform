import { z } from "zod";
import {
  CMS_SCHEMA_VERSION,
  type Block,
  type BuiltinCmsPage,
  type CmsPage,
  type CmsPersistedState,
  type PageDraft,
} from "./types";
import type { PageSectionContent } from "./content";
import { layoutFromBlocks, newBlockLayoutItem, type LayoutItem } from "./layout";
import { parseContentAlign } from "./layout-presentation";
import { CURRENT_LAYOUT_VERSION, isFixedSectionKey } from "./sections";
import { normalizeCmsPage, resolvePageKey } from "./pipeline";
import { defaultSiteNavigation, parseSiteNavigation } from "./navigation";
import { navigationWithResolvedCustomLinks } from "./nav-custom-pages";
import { ensurePageLocaleFields } from "./migrate-locale";

const blockSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.unknown()),
  dataVersion: z.number().optional(),
});

const layoutItemSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("fixed"),
    key: z.string(),
    hidden: z.boolean().optional(),
    contentAlign: z.enum(["left", "center", "right"]).optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("block"),
    blockId: z.string(),
    hidden: z.boolean().optional(),
    contentAlign: z.enum(["left", "center", "right"]).optional(),
  }),
]);

const pageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  isCustom: z.boolean(),
  kind: z.enum(["builtin", "custom"]).optional(),
  pageKey: z.string().nullable().optional(),
  inNav: z.boolean(),
  blocks: z.array(blockSchema),
  extraBlocks: z.array(blockSchema).optional(),
  layout: z.array(layoutItemSchema).optional(),
  layoutVersion: z.number().optional(),
  /** Typed section map — must survive localStorage round-trips or Secties patches snap back. */
  sectionContent: z.record(z.unknown()).optional(),
  updatedAt: z.number(),
  version: z.number().optional(),
  updatedBy: z.string().optional(),
  isDraftOnly: z.boolean().optional(),
  /** v6 locale fields — optional on wire; ensurePageLocaleFields fills them. */
  paths: z.unknown().optional(),
  localeContent: z.unknown().optional(),
  localeStates: z.unknown().optional(),
  translationMeta: z.unknown().optional(),
  redirects: z.unknown().optional(),
  /** Phase E MVP EN drafts — string map. */
  enFieldDrafts: z.record(z.string()).optional(),
  /** NL sources paired with enFieldDrafts for stale detection. */
  enFieldDraftSources: z.record(z.string()).optional(),
  /** Per-field EN translation status metadata. */
  enFieldDraftMeta: z.record(z.unknown()).optional(),
  /** Producten fixed→blocks pilot — never infer from empty layout. */
  productsBlocksMigration: z
    .object({
      version: z.literal(1),
      status: z.enum(["not_started", "migrated", "verified"]),
      migratedAt: z.string().optional(),
      sources: z.array(z.enum(["products.main", "products.info"])).optional(),
    })
    .optional(),
});

const pageDraftSchema = z.object({
  overrides: z.record(z.string()).optional(),
  page: z.unknown().optional(),
  sectionContent: z.record(z.unknown()).optional(),
  blocks: z.array(blockSchema).optional(),
  extraBlocks: z.array(blockSchema).optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  inNav: z.boolean().optional(),
});

const persistedSchema = z.object({
  schemaVersion: z.number().optional(),
  pages: z.array(pageSchema),
  saved: z.record(z.record(z.string())).optional(),
  draft: z.record(z.unknown()).optional(),
  navigation: z.unknown().optional(),
  navigationDraft: z.unknown().optional(),
  previewSnapshots: z.record(z.unknown()).optional(),
  version: z.number().optional(),
  corruptPayload: z.string().optional(),
  migrationRecovery: z.string().optional(),
});

function migrateLayoutFromRaw(raw: z.infer<typeof pageSchema>): LayoutItem[] {
  if (!raw.layout?.length) return [];
  const items: LayoutItem[] = [];
  for (const item of raw.layout) {
    const contentAlign = parseContentAlign(item.contentAlign);
    if (item.kind === "fixed") {
      if (!isFixedSectionKey(item.key)) continue;
      items.push({
        id: (item.id.startsWith("fixed:") ? item.id : `fixed:${item.key.replace(/\./g, ":")}`) as `fixed:${string}`,
        kind: "fixed",
        key: item.key,
        hidden: Boolean(item.hidden),
        ...(contentAlign ? { contentAlign } : {}),
      });
      continue;
    }
    items.push({
      id: item.id,
      kind: "block",
      blockId: item.blockId,
      ...(item.hidden === true ? { hidden: true } : {}),
      ...(contentAlign ? { contentAlign } : {}),
    });
  }
  return items;
}

/**
 * Deterministic, idempotent page migration:
 * extraBlocks → appended into blocks + layout block items.
 */
export function migratePage(raw: z.infer<typeof pageSchema>): CmsPage {
  const extras = (raw.extraBlocks as Block[] | undefined) ?? [];
  const blocks = [...(raw.blocks as Block[])];
  const seen = new Set(blocks.map((b) => b.id));
  for (const b of extras) {
    if (!seen.has(b.id)) {
      blocks.push(b);
      seen.add(b.id);
    }
  }

  let layout = migrateLayoutFromRaw(raw);

  // Append migrated extras as block layout items when layout already existed without them.
  if (extras.length) {
    const used = new Set(
      layout.filter((i): i is Extract<LayoutItem, { kind: "block" }> => i.kind === "block").map((i) => i.blockId),
    );
    for (const b of extras) {
      if (!used.has(b.id)) {
        layout.push(newBlockLayoutItem(b.id));
        used.add(b.id);
      }
    }
  }

  // When no layout yet, start empty so normalize builds defaults + extras only.
  if (!layout.length && extras.length) {
    layout = extras.map((b) => newBlockLayoutItem(b.id));
  }

  if (raw.isCustom) {
    const page: CmsPage = {
      kind: "custom",
      isCustom: true,
      id: raw.id,
      slug: raw.slug,
      title: raw.title,
      description: raw.description,
      inNav: raw.inNav,
      blocks,
      layout: layout.length
        ? (layout.filter((i) => i.kind === "block") as ReturnType<typeof layoutFromBlocks>)
        : layoutFromBlocks(blocks),
      layoutVersion: raw.layoutVersion ?? CURRENT_LAYOUT_VERSION,
      updatedAt: raw.updatedAt,
      version: raw.version ?? 1,
      updatedBy: raw.updatedBy,
      isDraftOnly: raw.isDraftOnly,
      enFieldDrafts: raw.enFieldDrafts,
      enFieldDraftSources: raw.enFieldDraftSources,
      enFieldDraftMeta: raw.enFieldDraftMeta as CmsPage["enFieldDraftMeta"],
      paths: (raw.paths as CmsPage["paths"]) ?? { nl: raw.slug },
      localeContent: raw.localeContent as CmsPage["localeContent"],
      localeStates: raw.localeStates as CmsPage["localeStates"],
      translationMeta: (raw.translationMeta as CmsPage["translationMeta"]) ?? {},
      redirects: (raw.redirects as CmsPage["redirects"]) ?? [],
    };
    return ensurePageLocaleFields(normalizeCmsPage(page));
  }

  const pageKey = resolvePageKey({
    id: raw.id,
    slug: raw.slug,
    isCustom: false,
    pageKey: raw.pageKey,
  });

  const page: CmsPage = {
    kind: "builtin",
    isCustom: false,
    pageKey,
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    inNav: raw.inNav,
    blocks,
    layout,
    layoutVersion: raw.layoutVersion ?? 0,
    sectionContent: (raw.sectionContent ?? {}) as BuiltinCmsPage["sectionContent"],
    updatedAt: raw.updatedAt,
    version: raw.version ?? 1,
    updatedBy: raw.updatedBy,
    isDraftOnly: raw.isDraftOnly,
    enFieldDrafts: raw.enFieldDrafts,
    enFieldDraftSources: raw.enFieldDraftSources,
    enFieldDraftMeta: raw.enFieldDraftMeta as CmsPage["enFieldDraftMeta"],
    productsBlocksMigration: raw.productsBlocksMigration,
    // Pass extras through once so normalize can merge if layout was empty defaults path
    extraBlocks: extras.length ? extras : undefined,
    paths: (raw.paths as CmsPage["paths"]) ?? { nl: raw.slug },
    localeContent: raw.localeContent as CmsPage["localeContent"],
    localeStates: raw.localeStates as CmsPage["localeStates"],
    translationMeta: (raw.translationMeta as CmsPage["translationMeta"]) ?? {},
    redirects: (raw.redirects as CmsPage["redirects"]) ?? [],
  };

  return ensurePageLocaleFields(normalizeCmsPage(page));
}

function normalizeDraft(raw: unknown): PageDraft {
  // Legacy: draft[pageId] was PageOverrides (flat string map)
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (
      "overrides" in obj ||
      "blocks" in obj ||
      "extraBlocks" in obj ||
      "page" in obj ||
      "sectionContent" in obj ||
      "title" in obj ||
      "slug" in obj
    ) {
      const parsed = pageDraftSchema.safeParse(obj);
      if (parsed.success) {
        let draftPage: CmsPage | undefined;
        if (parsed.data.page) {
          const pageParsed = pageSchema.safeParse(parsed.data.page);
          if (pageParsed.success) draftPage = migratePage(pageParsed.data);
        }
        const draftSectionContent = parsed.data.sectionContent
          ? (parsed.data.sectionContent as PageSectionContent)
          : undefined;
        return {
          overrides: parsed.data.overrides ?? {},
          page: draftPage,
          sectionContent: draftSectionContent,
          blocks: parsed.data.blocks as Block[] | undefined,
          extraBlocks: parsed.data.extraBlocks as Block[] | undefined,
          title: parsed.data.title,
          slug: parsed.data.slug,
          description: parsed.data.description,
          inNav: parsed.data.inNav,
        };
      }
    }
    const overrides: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") overrides[k] = v;
    }
    return { overrides };
  }
  return { overrides: {} };
}

export type LoadResult =
  | { ok: true; state: CmsPersistedState }
  | { ok: false; reason: string; corruptPayload?: string };

/**
 * parse → migrate → normalize pipeline for persisted CMS state.
 * Keeps a recovery copy when upgrading from schema < 3.
 */
export function migrateAndValidate(raw: unknown): LoadResult {
  try {
    const parsed = persistedSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        reason: "CMS data failed schema validation.",
        corruptPayload: typeof raw === "string" ? raw : JSON.stringify(raw),
      };
    }

    const data = parsed.data;
    const schemaVersion = data.schemaVersion ?? 1;

    const draft: Record<string, PageDraft> = {};
    for (const [pageId, value] of Object.entries(data.draft ?? {})) {
      draft[pageId] = normalizeDraft(value);
    }

    const pages = data.pages.map(migratePage);

    const recovery =
      data.migrationRecovery ??
      (schemaVersion < CMS_SCHEMA_VERSION
        ? typeof raw === "string"
          ? raw
          : JSON.stringify(raw)
        : undefined);

    const navigationRaw = parseSiteNavigation(data.navigation) ?? defaultSiteNavigation();
    const navigationDraftRaw =
      data.navigationDraft == null ? null : parseSiteNavigation(data.navigationDraft);
    // Drop orphans, collapse duplicate custom-page / same-path links, backfill inNav.
    // Idempotent self-heal for stale mccoy_cms_v1 localStorage from create/delete cycles.
    const navigation = navigationWithResolvedCustomLinks(navigationRaw, pages);
    const navigationDraftParsed = navigationDraftRaw
      ? navigationWithResolvedCustomLinks(navigationDraftRaw, pages)
      : null;

    const state: CmsPersistedState = {
      schemaVersion: CMS_SCHEMA_VERSION,
      pages,
      saved: data.saved ?? {},
      draft,
      navigation,
      navigationDraft: navigationDraftParsed,
      previewSnapshots: {},
      version: data.version ?? schemaVersion,
      migrationRecovery: recovery,
    };

    return { ok: true, state };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Unknown CMS load error",
      corruptPayload: typeof raw === "string" ? raw : JSON.stringify(raw),
    };
  }
}

/** Exposed for unit tests / callers that only have a single page blob. */
export function parseMigrateNormalizePage(raw: unknown): CmsPage | null {
  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) return null;
  return migratePage(parsed.data);
}
