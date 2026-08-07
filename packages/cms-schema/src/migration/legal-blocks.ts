/**
 * Privacy / Terms fixed→reusable `legalArticles` migration.
 * Admin persists; storefront/admin preview resolve in memory via
 * {@link resolveLegalBlocksLayout} / {@link resolveCmsPageForDisplay}.
 *
 * Sources: privacy.main | terms.main → one legalArticles block each.
 * NL article body is preserved exactly. EN drafts are remapped / seeded only
 * from known i18n nav labels (never fabricated legal prose).
 */

import { z } from "zod";
import type { BuiltinCmsPage, Block, BlockType } from "../types";
import type { LayoutItem, FixedLayoutItem, BlockLayoutItem } from "../layout";
import { CURRENT_LAYOUT_VERSION, type FixedSectionKey } from "../sections";
import { getBlockDataDefinition } from "../blocks/registry";
import {
  normalizeLegalArticles,
  type LegalArticlesBlockData,
} from "../blocks/new-sections";
import {
  defaultSectionContent,
  type LegalMainContent,
} from "../content";
import { createMigrationBlockId } from "./block-id";

export const LEGAL_BLOCKS_MIGRATION_VERSION = 1 as const;

export const legalBlocksMigrationStatusSchema = z.enum([
  "not_started",
  "migrated",
  "verified",
]);

export type LegalBlocksMigrationStatus = z.infer<typeof legalBlocksMigrationStatusSchema>;

export const legalBlocksMigrationStateSchema = z.object({
  version: z.literal(LEGAL_BLOCKS_MIGRATION_VERSION),
  status: legalBlocksMigrationStatusSchema,
  migratedAt: z.string().optional(),
  sources: z.array(z.enum(["privacy.main", "terms.main"])).optional(),
});

export type LegalBlocksMigrationState = z.infer<typeof legalBlocksMigrationStateSchema>;

export type LegalMigrationReport = {
  pageId: string;
  fromVersion: number;
  toVersion: number;
  foundFixed: boolean;
  createdBlocks: Array<{
    id: string;
    type: BlockType;
    source: "privacy.main" | "terms.main";
  }>;
  localePathsRemapped: number;
  warnings: string[];
  errors: string[];
};

export type ResolveLegalBlocksResult = {
  page: BuiltinCmsPage;
  report: LegalMigrationReport;
  changed: boolean;
};

/** Existing storefront/admin footer i18n EN labels — not invented legal prose. */
export const LEGAL_PAGE_HEADING_EN = {
  privacy: "Privacy statement",
  terms: "Terms & conditions",
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function parseLegalBlocksMigrationState(
  raw: unknown,
): LegalBlocksMigrationState | null {
  const parsed = legalBlocksMigrationStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function legalMainMigrationBlockId(
  pageId: string,
  fixedKey: "privacy.main" | "terms.main",
): string {
  return createMigrationBlockId({
    pageId,
    fixedKey,
    role: "primary",
  });
}

function emptyReport(page: BuiltinCmsPage): LegalMigrationReport {
  return {
    pageId: page.id,
    fromVersion: page.layoutVersion,
    toVersion: page.layoutVersion,
    foundFixed: false,
    createdBlocks: [],
    localePathsRemapped: 0,
    warnings: [],
    errors: [],
  };
}

function layoutHasFixed(layout: LayoutItem[], key: FixedSectionKey): boolean {
  return layout.some((i) => i.kind === "fixed" && i.key === key);
}

function fixedKeyForPage(
  pageKey: BuiltinCmsPage["pageKey"],
): "privacy.main" | "terms.main" | null {
  if (pageKey === "privacy") return "privacy.main";
  if (pageKey === "terms") return "terms.main";
  return null;
}

function hasLegalArticlesBlock(
  page: BuiltinCmsPage,
  fixedKey: "privacy.main" | "terms.main",
): boolean {
  const id = legalMainMigrationBlockId(page.id, fixedKey);
  return page.blocks.some((b) => b.id === id && b.type === "legalArticles");
}

function slugifyAnchor(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "artikel"
  );
}

/** Map fixed privacy.main / terms.main → legalArticles (exact NL copy). */
export function mapLegalMainToLegalArticlesData(
  content: unknown,
  pageKey: "privacy" | "terms",
): { data: LegalArticlesBlockData; warnings: string[] } {
  const warnings: string[] = [];
  const factory = defaultSectionContent(
    pageKey === "privacy" ? "privacy.main" : "terms.main",
  ) as LegalMainContent;
  const rec = isRecord(content) ? content : {};
  if (!isRecord(content)) {
    warnings.push(`${pageKey}.main: missing content; using factory defaults`);
  }

  const seenAnchors = new Set<string>();
  const rawArticles = Array.isArray(rec.articles)
    ? rec.articles
    : factory.articles;

  const articles = rawArticles.map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const heading =
      (typeof row.heading === "string" && row.heading) ||
      (typeof row.title === "string" && row.title) ||
      factory.articles[index]?.title ||
      `Artikel ${index + 1}`;
    let anchor =
      (typeof row.anchor === "string" && row.anchor.trim()) || slugifyAnchor(heading);
    anchor = slugifyAnchor(anchor);
    let unique = anchor;
    let n = 2;
    while (seenAnchors.has(unique)) {
      unique = `${anchor}-${n++}`;
    }
    seenAnchors.add(unique);
    const body =
      typeof row.content === "string"
        ? row.content
        : typeof row.body === "string"
          ? row.body
          : factory.articles[index]?.body ?? "";
    return {
      id:
        (typeof row.id === "string" && row.id.trim()) ||
        factory.articles[index]?.id ||
        `legal_item_${index + 1}`,
      heading,
      anchor: unique,
      content: body,
    };
  });

  const data = normalizeLegalArticles({
    eyebrow:
      (typeof rec.eyebrow === "string" && rec.eyebrow.trim()) ||
      factory.eyebrow ||
      undefined,
    heading:
      (typeof rec.heading === "string" && rec.heading.trim()) ||
      (typeof rec.title === "string" && rec.title.trim()) ||
      factory.heading,
    updatedLabel:
      (typeof rec.updatedLabel === "string" && rec.updatedLabel.trim()) ||
      factory.updatedLabel ||
      undefined,
    updatedAt:
      typeof rec.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rec.updatedAt)
        ? rec.updatedAt
        : undefined,
    articles,
  });

  return { data, warnings };
}

export function remapLegalEnFieldDrafts(input: {
  pageId: string;
  pageKey: "privacy" | "terms";
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
  const fixedKey = input.pageKey === "privacy" ? "privacy.main" : "terms.main";
  const id = legalMainMigrationBlockId(input.pageId, fixedKey);

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

  move(`section:${fixedKey}:eyebrow`, `block:${id}:eyebrow`);
  move(`section:${fixedKey}:heading`, `block:${id}:heading`);
  move(`section:${fixedKey}:updatedLabel`, `block:${id}:updatedLabel`);

  // Article paths: section:….articles.N.title|body → block:….articles.N.heading|content
  const articlePrefix = `section:${fixedKey}:articles.`;
  for (const path of Object.keys(drafts)) {
    if (!path.startsWith(articlePrefix)) continue;
    const rest = path.slice(articlePrefix.length);
    const m = /^(\d+)\.(title|body|heading|content)$/.exec(rest);
    if (!m) continue;
    const index = m[1]!;
    const leaf = m[2]!;
    const nextLeaf =
      leaf === "title" || leaf === "heading"
        ? "heading"
        : leaf === "body" || leaf === "content"
          ? "content"
          : null;
    if (!nextLeaf) continue;
    move(path, `block:${id}:articles.${index}.${nextLeaf}`);
  }

  return { enFieldDrafts: drafts, enFieldDraftSources: sources, localePathsRemapped };
}

/** Seed EN heading from known footer i18n when no EN draft exists yet. */
export function seedLegalHeadingEnDraft(input: {
  pageId: string;
  pageKey: "privacy" | "terms";
  nlHeading: string;
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
}): {
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
  seeded: boolean;
} {
  const fixedKey = input.pageKey === "privacy" ? "privacy.main" : "terms.main";
  const id = legalMainMigrationBlockId(input.pageId, fixedKey);
  const path = `block:${id}:heading`;
  const drafts = { ...input.enFieldDrafts };
  const sources = { ...input.enFieldDraftSources };
  if (path in drafts && drafts[path]!.trim()) {
    return { enFieldDrafts: drafts, enFieldDraftSources: sources, seeded: false };
  }
  drafts[path] = LEGAL_PAGE_HEADING_EN[input.pageKey];
  sources[path] = input.nlHeading;
  return { enFieldDrafts: drafts, enFieldDraftSources: sources, seeded: true };
}

export function shouldServeLegalMigratedBlock(page: BuiltinCmsPage): boolean {
  const state = parseLegalBlocksMigrationState(page.legalBlocksMigration);
  if (!state) return false;
  if (state.status !== "migrated" && state.status !== "verified") return false;
  const fixedKey = fixedKeyForPage(page.pageKey);
  if (!fixedKey) return false;
  return hasLegalArticlesBlock(page, fixedKey);
}

export function suppressedLegalFixedKeys(page: BuiltinCmsPage): Set<FixedSectionKey> {
  const out = new Set<FixedSectionKey>();
  const fixedKey = fixedKeyForPage(page.pageKey);
  if (!fixedKey) return out;

  if (shouldServeLegalMigratedBlock(page)) {
    out.add(fixedKey);
    return out;
  }

  const id = legalMainMigrationBlockId(page.id, fixedKey);
  const blockIds = new Set(
    page.layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
  );
  if (layoutHasFixed(page.layout, fixedKey) && blockIds.has(id)) {
    out.add(fixedKey);
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
 * Canonical Privacy/Terms resolver. Does not persist.
 * Replaces fixed privacy.main / terms.main with a deterministic legalArticles block.
 */
export function resolveLegalBlocksLayout(page: BuiltinCmsPage): ResolveLegalBlocksResult {
  const report = emptyReport(page);
  const pageKey = page.pageKey;
  if (pageKey !== "privacy" && pageKey !== "terms") {
    return { page, report, changed: false };
  }
  const fixedKey = fixedKeyForPage(pageKey)!;

  const state =
    parseLegalBlocksMigrationState(page.legalBlocksMigration) ??
    ({
      version: LEGAL_BLOCKS_MIGRATION_VERSION,
      status: "not_started",
    } satisfies LegalBlocksMigrationState);

  if (state.status === "migrated" || state.status === "verified") {
    report.foundFixed = hasLegalArticlesBlock(page, fixedKey);
    if (layoutHasFixed(page.layout, fixedKey) && hasLegalArticlesBlock(page, fixedKey)) {
      const next: BuiltinCmsPage = {
        ...structuredClone(page),
        layout: page.layout.filter((i) => !(i.kind === "fixed" && i.key === fixedKey)),
      };
      return { page: next, report, changed: true };
    }
    return { page, report, changed: false };
  }

  const foundFixed = layoutHasFixed(page.layout, fixedKey);
  report.foundFixed = foundFixed;

  if (!foundFixed) {
    if (hasLegalArticlesBlock(page, fixedKey)) {
      return {
        page: {
          ...structuredClone(page),
          legalBlocksMigration: {
            version: LEGAL_BLOCKS_MIGRATION_VERSION,
            status: "migrated",
            migratedAt: new Date().toISOString(),
            sources: [fixedKey],
          },
        },
        report,
        changed: true,
      };
    }
    return { page, report, changed: false };
  }

  const content = page.sectionContent?.[fixedKey];
  if (content !== undefined && content !== null && !isRecord(content)) {
    report.errors.push(`${fixedKey} malformed: expected object section content`);
    return { page, report, changed: false };
  }

  const mapped = mapLegalMainToLegalArticlesData(
    content ?? defaultSectionContent(fixedKey),
    pageKey,
  );
  report.warnings.push(...mapped.warnings);

  const def = getBlockDataDefinition("legalArticles");
  const parsed = def.schema.safeParse(def.normalize(mapped.data));
  if (!parsed.success) {
    report.errors.push(
      `${fixedKey} malformed: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
    return { page, report, changed: false };
  }

  const id = legalMainMigrationBlockId(page.id, fixedKey);
  let blocks = upsertBlock(page.blocks.slice(), {
    id,
    type: "legalArticles",
    data: parsed.data as Record<string, unknown>,
    dataVersion: def.dataVersion,
  });

  const nextLayout: LayoutItem[] = [];
  for (const item of page.layout) {
    if (item.kind === "fixed" && item.key === fixedKey) {
      nextLayout.push(blockLayoutFromFixed(item, id));
      report.createdBlocks.push({ id, type: "legalArticles", source: fixedKey });
      continue;
    }
    nextLayout.push(item);
  }

  const remapped = remapLegalEnFieldDrafts({
    pageId: page.id,
    pageKey,
    enFieldDrafts: page.enFieldDrafts ?? {},
    enFieldDraftSources: page.enFieldDraftSources ?? {},
  });
  report.localePathsRemapped = remapped.localePathsRemapped;

  const nlHeading =
    typeof (parsed.data as LegalArticlesBlockData).heading === "string"
      ? (parsed.data as LegalArticlesBlockData).heading
      : pageKey === "privacy"
        ? "Privacyverklaring"
        : "Algemene Voorwaarden";

  const seeded = seedLegalHeadingEnDraft({
    pageId: page.id,
    pageKey,
    nlHeading,
    enFieldDrafts: remapped.enFieldDrafts,
    enFieldDraftSources: remapped.enFieldDraftSources,
  });

  const next: BuiltinCmsPage = {
    ...structuredClone(page),
    blocks,
    layout: nextLayout,
    layoutVersion: Math.max(page.layoutVersion ?? 0, CURRENT_LAYOUT_VERSION),
    enFieldDrafts: seeded.enFieldDrafts,
    enFieldDraftSources: seeded.enFieldDraftSources,
    legalBlocksMigration: {
      version: LEGAL_BLOCKS_MIGRATION_VERSION,
      status: "migrated",
      migratedAt: new Date().toISOString(),
      sources: [fixedKey],
    },
  };
  report.toVersion = next.layoutVersion;
  return { page: next, report, changed: true };
}

export function markLegalBlocksMigrationVerified(page: BuiltinCmsPage): BuiltinCmsPage {
  const state = parseLegalBlocksMigrationState(page.legalBlocksMigration);
  if (!state || state.status === "not_started") return page;
  return {
    ...page,
    legalBlocksMigration: {
      ...state,
      status: "verified",
    },
  };
}
