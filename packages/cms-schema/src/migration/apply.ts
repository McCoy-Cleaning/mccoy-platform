import type { BuiltinCmsPage, Block, BlockType } from "../types";
import type { LayoutItem } from "../layout";
import { isFixedSectionKey, type FixedSectionKey } from "../sections";
import { getBlockDataDefinition } from "../blocks/registry";
import {
  BLOCKS_ONLY_LAYOUT_VERSION,
  createMigrationBlockId,
} from "./block-id";
import { checksumOf } from "./checksum";
import { createRollbackSnapshot, type MigrationRollbackSnapshot } from "./rollback";
import { FIXED_SECTION_MIGRATION_ROLES } from "./roles";
import { dryRunFixedToBlocksMigration } from "./dry-run";
import type { PageMigrationReport } from "./report";
import type { LayoutMigrationMetadata } from "./metadata";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Map known legacy section content into strict block data (unknown keys dropped). */
export function mapFixedSectionToBlockData(
  fixedKey: FixedSectionKey,
  role: string,
  content: unknown,
): Record<string, unknown> {
  const rec = isRecord(content) ? content : {};
  const defType = FIXED_SECTION_MIGRATION_ROLES[fixedKey].find((r) => r.role === role)?.blockType;
  if (!defType) return {};

  try {
    const def = getBlockDataDefinition(defType as BlockType);
    // Build a seed object from known fields, then normalize through catalog.
    const seed = seedFromLegacy(fixedKey, role, rec);
    return def.normalize(seed) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function seedFromLegacy(
  fixedKey: FixedSectionKey,
  role: string,
  rec: Record<string, unknown>,
): Record<string, unknown> {
  if (fixedKey === "home.hero" || fixedKey.endsWith(".main") && role === "primary") {
    if (fixedKey === "about.main") {
      /* handled below */
    } else if (
      fixedKey === "home.hero" ||
      fixedKey === "contact.main" ||
      fixedKey === "vacatures.main" ||
      fixedKey === "offerte.main"
    ) {
      const accent =
        typeof rec.headingAccent === "string"
          ? { accent: rec.headingAccent.replace(/<[^>]+>/g, "") }
          : isRecord(rec.headingAccent)
            ? rec.headingAccent
            : undefined;
      return {
        eyebrow: rec.eyebrow,
        title: rec.heading ?? rec.title,
        subtitle: rec.body,
        headingAccent: accent,
        cta: rec.primaryCta ?? rec.cta,
        secondaryCta: rec.secondaryCta,
        image: rec.image,
      };
    }
  }
  if (fixedKey === "home.partners") {
    return {
      eyebrow: rec.eyebrow,
      heading: rec.heading ?? rec.title,
      items: rec.items,
      animate: true,
    };
  }
  if (fixedKey === "home.stats") {
    return {
      eyebrow: rec.eyebrow,
      heading: rec.heading ?? rec.title,
      body: rec.body,
      items: Array.isArray(rec.items)
        ? rec.items.map((entry) => {
            const row = isRecord(entry) ? entry : {};
            return {
              id: row.id,
              value: row.value ?? row.number,
              label: row.label ?? row.title,
              prefix: row.prefix,
              suffix: row.suffix,
              supportingText: row.supportingText ?? row.body,
              animate: true,
            };
          })
        : [],
    };
  }
  if (fixedKey === "home.workGallery") {
    return {
      title: rec.heading ?? rec.title,
      eyebrow: rec.eyebrow,
      body: rec.body,
      layout: "featured",
      images: Array.isArray(rec.items)
        ? rec.items.map((entry) => {
            const row = isRecord(entry) ? entry : {};
            return {
              id: row.id,
              title: row.title,
              caption: row.caption,
              image: row.image,
              shape: row.shape ?? "square",
            };
          })
        : [],
    };
  }
  if (fixedKey === "about.main") {
    if (role === "intro") {
      return { title: rec.heading ?? rec.title ?? "Over ons", body: rec.intro ?? rec.body };
    }
    if (role === "mission") {
      return {
        title: rec.missionTitle ?? "Missie",
        body: rec.missionBody ?? (isRecord(rec.mission) ? rec.mission.body : undefined),
        image: isRecord(rec.mission) ? rec.mission.image : undefined,
      };
    }
    if (role === "vision") {
      return {
        title: rec.visionTitle ?? "Visie",
        body: rec.visionBody ?? (isRecord(rec.vision) ? rec.vision.body : undefined),
        image: isRecord(rec.vision) ? rec.vision.image : undefined,
      };
    }
    if (role === "history") {
      return {
        title: rec.historyTitle ?? "Historie",
        body: rec.historyBody ?? (isRecord(rec.history) ? rec.history.body : undefined),
        image: isRecord(rec.history) ? rec.history.image : undefined,
      };
    }
  }
  if (fixedKey === "services.main") {
    if (role === "intro" || role === "primary") {
      return { title: rec.heading ?? "Diensten", body: rec.intro ?? rec.body };
    }
  }
  if (fixedKey === "services.cards") {
    const cards = Array.isArray(rec.cards)
      ? rec.cards
      : Array.isArray(rec.items)
        ? rec.items
        : [];
    return {
      title: rec.heading ?? "Diensten",
      projects: cards.map((entry) => {
        const row = isRecord(entry) ? entry : {};
        return {
          id: row.id,
          title: row.title ?? row.name,
          category: row.category,
          image: row.image,
        };
      }),
    };
  }
  if (fixedKey === "products.main") {
    const intro = typeof rec.intro === "string" ? rec.intro.trim() : "";
    const notice = typeof rec.body === "string" ? rec.body.trim() : "";
    return {
      presentation: "productsIntro",
      title: rec.heading ?? rec.title,
      body: intro || undefined,
      notice: notice || undefined,
      eyebrow: typeof rec.eyebrow === "string" ? rec.eyebrow : undefined,
      image: rec.image,
      reverse: false,
    };
  }
  if (fixedKey === "products.info") {
    const items = Array.isArray(rec.items) ? rec.items : Array.isArray(rec.cards) ? rec.cards : [];
    return {
      presentation: "productsAssortment",
      title: rec.heading ?? "Productinfo",
      eyebrow: typeof rec.eyebrow === "string" ? rec.eyebrow : undefined,
      intro: typeof rec.intro === "string" ? rec.intro : undefined,
      features: items.map((entry) => {
        const row = isRecord(entry) ? entry : {};
        return {
          id: row.id,
          icon: row.icon ?? "sparkles",
          title: row.title ?? row.label,
          body: row.body ?? row.description ?? "",
          link: row.link,
        };
      }),
    };
  }
  if (fixedKey === "contact.info" || fixedKey === "offerte.info") {
    return {
      eyebrow: rec.eyebrow,
      heading: rec.heading,
      items: rec.items,
    };
  }
  if (fixedKey === "contact.form") {
    return {
      title: rec.heading ?? "Contact",
      body: rec.body,
      submitLabel: rec.submitLabel,
      successMessage: rec.successMessage,
      scope: isRecord(rec.formScope) ? rec.formScope : rec.scope,
    };
  }
  if (fixedKey === "offerte.form") {
    return {
      heading: rec.heading ?? "Offerte aanvragen",
      description: rec.description ?? rec.body,
      enabledScopes: ["glass_cleaning", "furniture_cleaning"],
      defaultScope: "glass_cleaning",
      submitLabel: rec.submitLabel ?? "Verstuur aanvraag",
      successMessage: rec.successMessage ?? "Bedankt — we nemen zo snel mogelijk contact op.",
    };
  }
  if (fixedKey === "privacy.main" || fixedKey === "terms.main") {
    return {
      heading: rec.heading ?? rec.title,
      updatedLabel: rec.updatedLabel,
      updatedAt: rec.updatedAt,
      articles: Array.isArray(rec.articles)
        ? rec.articles.map((entry) => {
            const row = isRecord(entry) ? entry : {};
            return {
              id: row.id,
              heading: row.heading ?? row.title,
              anchor: row.anchor,
              content: row.content ?? row.body ?? "",
            };
          })
        : [],
    };
  }
  return { ...rec };
}

export type ApplyMigrationResult =
  | {
      ok: true;
      page: BuiltinCmsPage;
      report: PageMigrationReport;
      metadata: LayoutMigrationMetadata;
      rollback: MigrationRollbackSnapshot;
    }
  | { ok: false; report: PageMigrationReport; rollback?: MigrationRollbackSnapshot };

/**
 * Apply fixed→blocks migration in memory (idempotent).
 * Does not persist. Sets metadata.status to "migrated" (not verified).
 * Callers must read-back, verify checksums/aliases/policies, then set "verified".
 */
export function applyFixedToBlocksMigration(page: BuiltinCmsPage): ApplyMigrationResult {
  const report = dryRunFixedToBlocksMigration(page, { dryRun: false });
  const rollback = createRollbackSnapshot(
    page,
    `rollback_${page.id}_${report.legacyChecksum.slice(0, 12)}`,
  );

  if (report.errors.length) {
    return { ok: false, report, rollback };
  }

  if (page.kind !== "builtin" || !page.pageKey) {
    report.errors.push("Not a layout-capable builtin page.");
    return { ok: false, report, rollback };
  }

  // Already blocks-only with no fixed items → idempotent no-op page clone.
  const fixedItems = page.layout.filter((i) => i.kind === "fixed");
  if (fixedItems.length === 0) {
    const metadata: LayoutMigrationMetadata = {
      status: "migrated",
      fromVersion: page.layoutVersion,
      toVersion: BLOCKS_ONLY_LAYOUT_VERSION,
      migratedAt: new Date().toISOString(),
      legacyChecksum: report.legacyChecksum,
      migratedChecksum: report.migratedChecksum,
      migrationId: `mig_${page.id}_${report.migratedChecksum.slice(0, 8)}`,
      rollbackSnapshotId: rollback.id,
    };
    return {
      ok: true,
      page: {
        ...structuredClone(page),
        layoutVersion: BLOCKS_ONLY_LAYOUT_VERSION,
      },
      report,
      metadata,
      rollback,
    };
  }

  const nextBlocks: Block[] = [...page.blocks];
  const existingIds = new Set(nextBlocks.map((b) => b.id));
  const nextLayout: LayoutItem[] = [];

  for (const item of page.layout) {
    if (item.kind === "block") {
      nextLayout.push(item);
      continue;
    }
    if (item.kind !== "fixed" || !isFixedSectionKey(item.key)) {
      report.errors.push(`Cannot migrate layout item ${item.id}`);
      return { ok: false, report, rollback };
    }
    const content = (page.sectionContent as Record<string, unknown> | undefined)?.[item.key];
    for (const spec of FIXED_SECTION_MIGRATION_ROLES[item.key]) {
      const blockId = createMigrationBlockId({
        pageId: page.id,
        fixedKey: item.key,
        role: spec.role,
      });
      const data = mapFixedSectionToBlockData(item.key, spec.role, content);
      if (!existingIds.has(blockId)) {
        nextBlocks.push({
          id: blockId,
          type: spec.blockType as BlockType,
          data,
        });
        existingIds.add(blockId);
      } else {
        const idx = nextBlocks.findIndex((b) => b.id === blockId);
        if (idx >= 0) {
          nextBlocks[idx] = { ...nextBlocks[idx]!, data };
        }
      }
      nextLayout.push({
        id: `block:${blockId}`,
        kind: "block",
        blockId,
        ...(item.hidden ? { hidden: true } : {}),
        ...(item.contentAlign ? { contentAlign: item.contentAlign } : {}),
      });
    }
  }

  // Remap EN drafts section:* → block:{id}:* for migrated keys
  const enFieldDrafts = { ...(page.enFieldDrafts ?? {}) };
  const enFieldDraftSources = { ...(page.enFieldDraftSources ?? {}) };
  for (const created of report.blocksCreated) {
    const prefix = `section:${created.sourceFixedKey}:`;
    for (const [path, value] of Object.entries(page.enFieldDrafts ?? {})) {
      if (!path.startsWith(prefix)) continue;
      const field = path.slice(prefix.length);
      const nextPath = `block:${created.blockId}:${field}`;
      enFieldDrafts[nextPath] = value;
      delete enFieldDrafts[path];
      if (page.enFieldDraftSources?.[path] !== undefined) {
        enFieldDraftSources[nextPath] = page.enFieldDraftSources[path]!;
        delete enFieldDraftSources[path];
      }
    }
  }

  const migratedPage: BuiltinCmsPage = {
    ...structuredClone(page),
    blocks: nextBlocks,
    layout: nextLayout,
    layoutVersion: BLOCKS_ONLY_LAYOUT_VERSION,
    // Retain sectionContent as legacy backup (do not clear).
    sectionContent: page.sectionContent,
    enFieldDrafts,
    enFieldDraftSources,
  };

  report.migratedChecksum = checksumOf({
    layout: migratedPage.layout,
    blocks: migratedPage.blocks.map((b) => ({ id: b.id, type: b.type })),
    layoutVersion: migratedPage.layoutVersion,
  });
  report.publishableAfterMigration = report.errors.length === 0;

  const metadata: LayoutMigrationMetadata = {
    status: "migrated",
    fromVersion: page.layoutVersion,
    toVersion: BLOCKS_ONLY_LAYOUT_VERSION,
    migratedAt: new Date().toISOString(),
    legacyChecksum: report.legacyChecksum,
    migratedChecksum: report.migratedChecksum,
    migrationId: `mig_${page.id}_${report.migratedChecksum.slice(0, 8)}`,
    rollbackSnapshotId: rollback.id,
  };

  return { ok: true, page: migratedPage, report, metadata, rollback };
}

/** Promote metadata to verified after caller checks. */
export function markMigrationVerified(
  meta: LayoutMigrationMetadata,
): LayoutMigrationMetadata {
  return { ...meta, status: "verified" };
}
